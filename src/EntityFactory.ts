import { EventEmitter } from "events";
import { EntityManager } from "./EntityManager";
import { CancelToken } from "./ES2017/CancelToken";
import { toIterable, merge } from "./ES2017/AsyncIterable";

export abstract class EntityFactory<E> {
    abstract entities ( cancel : CancelToken ) : AsyncIterable<E>;
}

export abstract class ConfigurableEntityFactory<E> extends EntityFactory<E> {
    abstract getEntitiesConfig () : any[];

    async * entities ( cancel : CancelToken ) : AsyncIterable<E> {
        const devices : E[] = [];

        for await ( let device of this.entitiesFromConfig( cancel ) ) {
            devices.push( device );
            
            yield device;
        }

        yield * this.entitiesFromScan( devices, cancel );
    }

    entitiesFromConfig ( cancel : CancelToken ) : AsyncIterable<E> {
        const entities : Promise<E>[] = [];

        for ( let config of this.getEntitiesConfig() ) {
            entities.push( this.createFromConfig( config ) );
        }

        return toIterable( entities );
    }

    async * entitiesFromScan ( hardcoded : E[], cancel : CancelToken ) : AsyncIterable<E> {}

    abstract createFromConfig ( config : any ) : Promise<E>;
}