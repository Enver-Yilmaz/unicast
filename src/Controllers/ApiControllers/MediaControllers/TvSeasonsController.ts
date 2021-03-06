import { TvSeasonMediaRecord } from "../../../MediaRecord";
import { MediaTable } from "../../../Database/Database";
import { Request, Response } from "restify";
import * as r from 'rethinkdb';
import { MediaTableController } from "./MediaController";

export class TvSeasonsController extends MediaTableController<TvSeasonMediaRecord> {
    sortingFields : string[] = [ 'number' ];

    defaultSortField : string = 'number';

    get table () : MediaTable<TvSeasonMediaRecord> {
        return this.server.database.tables.seasons;
    }

    getQuery ( req : Request, res : Response, query : r.Sequence ) : r.Sequence {
        query = super.getQuery( req, res, query );

        if ( req.query.show ) {
            query = query.filter( { tvShowId: req.query.show } );
        }
        
        return this.getTransientQuery( req, query );
    }

    async transformAll ( req : Request, res : Response, seasons : TvSeasonMediaRecord[] ) : Promise<any> {
        if ( req.query.episodes === 'true' ) {
            await this.server.database.tables.seasons.relations.episodes.applyAll( seasons );
        }

        for ( let season of seasons ) {
            const url = await this.server.getMatchingUrl( req );
            
            ( season as any ).cachedArtwork = this.server.artwork.getCachedObject( url, season.kind, season.id, season.art );

            if ( req.query.episodes === 'true' ) {
                for ( let episode of ( season as any).episodes ) {
                    episode.cachedArtwork = this.server.artwork.getCachedObject( url, episode.kind, episode.id, episode.art );        
                }
            }
        }

        return seasons;
    }
}