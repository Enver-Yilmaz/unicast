import { TvShowMediaRecord } from "../../../MediaRecord";
import { MediaTable } from "../../../Database/Database";
import { Request, Response } from "restify";
import { MediaTableController } from "./MediaController";
import * as r from 'rethinkdb';

export class TvShowsController extends MediaTableController<TvShowMediaRecord> {
    sortingFields : string[] = [ 'title', 'seasonsCount', 'rating', 'parentalRating', 'year', 'lastPlayed', 'addedAt' ]

    get table () : MediaTable<TvShowMediaRecord> {
        return this.server.database.tables.shows;
    }

    getQuery ( req : Request, res : Response, query : r.Sequence ) : r.Sequence {
        return this.getTransientQuery( req,
                this.getCollectionsQuery( req,
                this.getGenresQuery( req, 
                this.getWatchedQuery( req,
                    super.getQuery( req, res, query )
                ) ) ) );
    }

    async transformAll ( req : Request, res : Response, shows : TvShowMediaRecord[] ) : Promise<any> {
        shows = await super.transformAll( req, res, shows );

        const url = await this.server.getMatchingUrl( req );
        
        if ( req.query.seasons === 'true' ) {
            await this.server.database.tables.shows.relations.seasons.applyAll( shows );
        }
            
        if ( req.query.collections === 'true' ) {
            await this.server.database.tables.shows.relations.collections.applyAll( shows );
        }

        for ( let show of shows ) {
            ( show as any ).cachedArtwork = this.server.artwork.getCachedObject( url, show.kind, show.id, show.art );
         
            if ( req.query.seasons === 'true' ) {
                for ( let season of ( show as any).seasons ) {
                    season.cachedArtwork = this.server.artwork.getCachedObject( url, season.kind, season.id, season.art );        
                }
            }
        }

        return shows;
    }
}