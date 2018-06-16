import { ResourceNotFoundError, InvalidArgumentError } from "restify-errors";
import { PlaylistRecord, BaseTable } from "../../Database";
import { BaseTableController } from "../BaseTableController";
import { Request, Response } from "restify";
import { Route } from "../BaseController";
import * as r from 'rethinkdb';
import { MediaRecord } from "../../MediaRecord";
import { MediaSourceLike } from "../../MediaProviders/ProvidersManager";

export class PlaylistsController extends BaseTableController<PlaylistRecord> {
    defaultSortField : string = 'createdAt';

    sortingFields : string[] = [ 'createdAt', 'updatedAt' ];

    searchFields : string[] = [];

    get table () : BaseTable<PlaylistRecord> {
        return this.server.database.tables.playlists;
    }

    async transformDocument ( req : Request, res : Response, playlist : any, isNew : boolean ) : Promise<any> {
        playlist = {
            ...playlist,
            device: req.params.device,
            updatedAt: new Date()
        };

        if ( isNew ) {
            playlist.createdAt = new Date();
            playlist.references = playlist.references || [];
        } else {
            delete playlist.createdAt;
        }

        delete playlist.items;

        return playlist;
    }

    async getPlaylistItems ( req : Request, playlist : PlaylistRecord ) : Promise<MediaRecord[]> {
        const url = await this.server.getMatchingUrl( req );      

        const items = await Promise.all( ( playlist.references || [] ).map( ( { kind, id } ) => this.server.media.get( kind, id ) ) );

        for ( let item of items ) {
            ( item as any ).cachedArtwork = this.server.artwork.getCachedObject( url, item.kind, item.id, item.art );            
        }

        return items.filter( item => !!item );
    }

    async transform ( req : Request, res : Response, playlist : PlaylistRecord ) : Promise<any> {
        if ( req.query.items === 'true' ) {
            ( playlist as any ).items = await this.getPlaylistItems( req, playlist );
        }

        return playlist;
    }

    getQuery ( req : Request, res : Response, query : r.Sequence ) : r.Sequence {
        return query.filter( { device: req.params.device } );
    }

    @Route( 'get', '/last' )
    async last ( req : Request, res : Response ) {
        const playlists = await this.table.find( query => {
            query = query.orderBy( { index: r.desc( 'createdAt' ) } ).filter( { device: req.params.device } );

            if ( req.query.empty === 'exclude' ) {
                query.filter( doc => ( doc as any )( 'references' ).count().gt( 0 ) )
            } else if ( req.query.empty === 'include' ) {
                query.filter( doc => ( doc as any )( 'references' ).count().lt( 0 ) )
            }

            return query.limit( 1 );
        } );

        if ( !playlists.length ) {
            return null;
        }

        return this.transform( req, res, playlists[ 0 ] );
    }

    @Route( 'get', '/:id/items' )
    async getItems ( req : Request, res : Response ) : Promise<MediaRecord[]> {
        const playlist = await this.table.get( req.params.id );

        if ( !playlist ) {
            throw new ResourceNotFoundError( `Could not find resource with id "${ req.params.id }".` );
        }

        return await this.getPlaylistItems( req, playlist );
    }

    @Route( 'post', '/:id/items' )
    async storeItems ( req : Request, res : Response ) {
        let playlist = await this.table.get( req.params.id );

        if ( !playlist ) {
            throw new ResourceNotFoundError( `Could not find resource with id "${ req.params.id }".` );
        }

        const references = typeof req.body === 'string' ? JSON.parse( req.body ) : req.body;

        if ( !( references instanceof Array ) ) {
            throw new InvalidArgumentError( `The request body must be an array.` );
        }

        for ( let [ index, item ] of references.entries() ) {
            if ( !item.id && item.sources ) {
                const sources : MediaSourceLike = item.sources;

                const record = await this.server.media.createFromSources( sources );

                references[ index ] = { kind: record.kind, id: record.id };
            } else {
                if ( typeof item !== 'object' || typeof item.kind !== 'string' || typeof item.id !== 'string' ) {
                    throw new InvalidArgumentError( `Array's elements must be objects with the string properties "kind" and "id".` );
                }
            }
        }

        playlist = await this.table.update( playlist.id, {
            references: references,
            updatedAt: new Date()
        } );

        return await Promise.all( playlist.references.map( ( { kind, id } ) => this.server.media.get( kind, id ) ) );
    }
}