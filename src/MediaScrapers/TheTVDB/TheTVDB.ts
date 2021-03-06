import { IScraper } from "../IScraper";
import { AsyncCache, CacheOptions, CacheStorage } from "../ScraperCache";
import { MovieMediaRecord, TvShowMediaRecord, TvSeasonMediaRecord, TvEpisodeMediaRecord, ArtRecord, ArtRecordKind, MediaRecord, MediaKind } from "../../MediaRecord";
import * as TVDB from 'node-tvdb';
import { MediaRecordFactory } from "./MediaRecordFactory";
import { UnicastServer } from "../../UnicastServer";
import { DiagnosticsService } from "../../Diagnostics";

export class TheTVDB implements IScraper {
    server : UnicastServer;

    name : string = 'tvdb';

    diagnostics : DiagnosticsService;

    tvdb : TVDB;
    
    cache : AsyncCache<any> = new AsyncCache();

    factory : MediaRecordFactory;

    constructor ( apiKey : string ) {
        this.tvdb = new TVDB( apiKey );

        this.factory = new MediaRecordFactory();
    }

    onEntityInit () {
        this.diagnostics = this.server.diagnostics.service( `scrapers/${ this.name }` );

        this.cache.storage = new CacheStorage( this.server.storage.getPath( `cache/scrapers/${ this.name }.json` ) );

        this.cache.autoSaveDelay = 500;

        this.cache.cloneOnRetrieval = false;

        this.server.onStart.subscribe( () => this.cache.load() );
    }

    getCacheKey ( method : string, id : string ) : string {
        return `${ method }|${ id }`;
    }

    runCachedTask<T extends any> ( method : string, id : string, runner : () => Promise<T>, options : CacheOptions = {} ) {
        const key = this.getCacheKey( method, id );

        const cached = this.cache.get<T>( key, options );

        if ( cached ) {
            return cached;
        }

        return this.cache.set<T>( key, runner(), options );
    }


    /* Retrieve Records */
    getMovieArt ( id : string, kind ?: ArtRecordKind, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        return Promise.resolve( [] );
    }

    getMovie ( id : string, cache ?: CacheOptions ) : Promise<MovieMediaRecord> {
        return Promise.resolve( null );
    }

    getTvShowAllArt ( id : string, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        return this.runCachedTask<any[]>( 'getTvShowArt', id, async () => {
            const kinds = [ "fanart", "poster", "season", "seasonwide", "series" ];

            let art : ArtRecord[] = [];

            for ( let kind of kinds ) {
                for ( let image of await this.tvdb.getSeriesImages( id, kind ).catch( err => [] ) ) {
                    art.push( this.factory.createArtRecord( image ) );
                }
            }

            return art;
        }, cache );
    }

    async getTvShowArt ( id : string, kind ?: ArtRecordKind, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        let art = await this.getTvShowAllArt( id, cache );

        art = art.filter( art => art.season === null );

        if ( kind ) {
            art = art.filter( art => art.kind == kind );
        }

        return art;
    }

    getTvShow ( id : string, cache ?: CacheOptions ) : Promise<TvShowMediaRecord> {
        return this.runCachedTask<TvShowMediaRecord>( 'getTvShow', id, async () => {
            const rawShow = await this.tvdb.getSeriesById( +id );

            const summary = await this.tvdb.getEpisodesSummaryBySeriesId( +id );

            const art = await this.getTvShowAllArt( id, cache );

            return this.factory.createTvShowMediaRecord( rawShow, summary, art );
        }, cache );
    }

    getTvShowSeasons ( id : string, cache ?: CacheOptions ) : Promise<TvSeasonMediaRecord[]> {
        return this.runCachedTask<TvSeasonMediaRecord[]>( 'getTvShowSeasons', id, async () => {
            const show = await this.getTvShow( id, cache );

            const summary = await this.tvdb.getEpisodesSummaryBySeriesId( +id );

            const seasons : TvSeasonMediaRecord[] = [];

            for ( let season of summary.airedSeasons ) {
                const poster = ( await this.tvdb.getSeasonPosters( id, season ).catch( () => [] ) )[ 0 ];

                seasons.push( this.factory.createTvSeasonMediaRecord( show, season, poster ? this.factory.createArtRecord( poster ).url : null ) );
            }

            return seasons;
        }, cache );
    }

    getTvShowEpisodes ( id : string, cache ?: CacheOptions ) : Promise<TvEpisodeMediaRecord[]> {
        return this.runCachedTask<TvEpisodeMediaRecord[]>( 'getTvShowEpisodes', id, async () => {
            const show = await this.getTvShow( id );

            const episodes : any[] = await this.tvdb.getEpisodesBySeriesId( id );

            return episodes.map( ep => this.factory.createTvEpisodeMediaRecord( show, ep ) );
        }, cache ).then( episodes => episodes.map( episode => {
            episode.airedAt = typeof episode.airedAt === 'string' ? new Date( episode.airedAt ) : episode.airedAt;

            return episode;
         } ) );
    }

    getTvShowSeason ( id : string, season : number, cache ?: CacheOptions ) : Promise<TvSeasonMediaRecord> {
        season = +season;

        const key = `${id}S${season}`;

        return this.runCachedTask<TvSeasonMediaRecord>( 'getTvShowSeason', key, async () => {
            const episodes = await this.getTvShowSeasons( id );

            return episodes.find( ep => ep.number == season );
        }, cache );
    }

    getTvShowEpisode ( id : string, season : number, episode : number, cache ?: CacheOptions ) : Promise<TvEpisodeMediaRecord> {
        season = +season;
        episode = +episode;

        const key = `${id}S${season}E${episode}`;

        return this.runCachedTask<TvEpisodeMediaRecord>( 'getTvShowEpisode', key, async () => {
            const episodes = await this.getTvShowEpisodes( id );

            return episodes.find( ep => ep.seasonNumber == season && ep.number == episode );
        }, cache ).then( episode => {
            episode.airedAt = typeof episode.airedAt === 'string' ? new Date( episode.airedAt ) : episode.airedAt;
            
            return episode;
        } );
    }

    async getTvSeasonArt ( id : string, kind ?: ArtRecordKind, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        let art = await this.getTvShowAllArt( id, cache );

        art = art.filter( art => art.season !== null );

        if ( kind ) {
            art = art.filter( art => art.kind == kind );
        }

        return art;
    }

    getTvSeason ( id : string, cache ?: CacheOptions ) : Promise<TvSeasonMediaRecord> {
        return this.runCachedTask<TvSeasonMediaRecord>( 'getTvSeason', id, async () => {
            const [ showId, seasonNumber ] = id.split( 'S' );

            const seasons = await this.getTvShowSeasons( showId, cache );

            return seasons.find( season => season.number == +seasonNumber );
        }, cache );
    }

    getTvSeasonEpisodes ( id : string, cache ?: CacheOptions ) : Promise<TvEpisodeMediaRecord[]> {
        return this.runCachedTask<TvEpisodeMediaRecord[]>( 'getTvSeasonEpisodes', id, async () => {
            const [ showId, seasonNumber ] = id.split( 'S' );

            const episodes = await this.getTvShowEpisodes( showId, cache );

            return episodes.filter( episode => episode.seasonNumber == +seasonNumber );
        }, cache ).then( episodes => episodes.map( episode => {
            episode.airedAt = typeof episode.airedAt === 'string' ? new Date( episode.airedAt ) : episode.airedAt;

            return episode;
        } ) );
    }
    
    getTvEpisodeArt ( id : string, kind ?: ArtRecordKind, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        return Promise.resolve( [] );
    }

    getTvEpisode ( id : string, cache ?: CacheOptions ) : Promise<TvEpisodeMediaRecord> {
        return this.runCachedTask<TvEpisodeMediaRecord>( 'getTvEpisode', id, async () => {
            const episode = await this.tvdb.getEpisodeById( id, cache );

            const show = await this.getTvShow( episode.seriesId );

            return this.factory.createTvEpisodeMediaRecord( show, episode );
        }, cache ).then( episode => {
            episode.airedAt = typeof episode.airedAt === 'string' ? new Date( episode.airedAt ) : episode.airedAt;
            
            return episode;
        } );
    }

    /* Get Media Art */
    getMediaArt ( record : MediaRecord, kind ?: ArtRecordKind, cache ?: CacheOptions ) : Promise<ArtRecord[]> {
        const id = record.external.tvdb;

        if ( !id ) {
            return Promise.resolve( [] );
        }

        if ( record.kind === MediaKind.Movie ) {
            return this.getMovieArt( id, kind, cache );
        } else if ( record.kind === MediaKind.TvShow ) {
            return this.getTvShowArt( id, kind, cache );
        } else if ( record.kind === MediaKind.TvSeason ) {
            return this.getTvSeasonArt( id, kind, cache );
        } else if ( record.kind === MediaKind.TvEpisode ) {
            return this.getTvEpisodeArt( id, kind, cache );
        }
    }

    /* Search Records */
    searchMovie ( name : string, limit : number = 5, cache ?: CacheOptions ) : Promise<MovieMediaRecord[]> {
        return Promise.resolve( [] );
    }

    searchTvShow ( name : string, limit : number = 5, cache ?: CacheOptions ) : Promise<TvShowMediaRecord[]> {
        return this.runCachedTask<TvShowMediaRecord[]>( 'searchTvShow', '' + limit + '|' + name, async () => {
            const shows : TvShowMediaRecord[] = [];
            
            const matches = await this.tvdb.getSeriesByName( name ).catch( () => [] );

            for ( let show of matches.slice( 0, limit ) ) {
                try {
                    shows.push( await this.getTvShow( show.id ) );
                } catch ( err ) { console.error( name, err ) }
            }

            return shows;
        }, cache );
    }
}
