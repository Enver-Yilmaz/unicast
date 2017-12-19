import { IMediaReceiver, MediaPlayOptions, ReceiverStatus } from './IMediaReceiver'
import { EventEmitter } from "events";
import { MediaStream } from "../../MediaProviders/MediaStreams/MediaStream";
import { MediaRecord } from "../../MediaRecord";
import { UnicastServer } from "../../UnicastServer";
import { MediaSessionsManager } from "./MediaSessionsManager";
import { Transcoder } from '../../Transcoding/Transcoder';

export abstract class BaseReceiver extends EventEmitter implements IMediaReceiver {
    abstract readonly connected: boolean;

    readonly name : string;

    readonly type : string = 'chromecast';

    readonly server : UnicastServer;

    readonly sessions : MediaSessionsManager;

    transcoder : Transcoder<any>;

    constructor ( server : UnicastServer, name : string ) {
        super();
        
        this.server = server;
        this.name = name;
        this.sessions = new MediaSessionsManager( this, server.media );
    }

    abstract connect () : Promise<boolean>;
    
    abstract disconnect () : Promise<boolean>;
    
    abstract reconnect () : Promise<boolean>;
    
    abstract play ( session : string ) : Promise<ReceiverStatus>;

    abstract pause () : Promise<ReceiverStatus>;

    abstract resume () : Promise<ReceiverStatus>;
    
    abstract stop () : Promise<ReceiverStatus>;

    abstract status () : Promise<ReceiverStatus>;

    abstract seek ( time : number ) : Promise<ReceiverStatus>;

    abstract seekTo ( time : number ) : Promise<ReceiverStatus>;

    abstract callCommand<R = any, A = any[]> ( commandName : string, args : A ) : Promise<R>;

    abstract toJSON();
}