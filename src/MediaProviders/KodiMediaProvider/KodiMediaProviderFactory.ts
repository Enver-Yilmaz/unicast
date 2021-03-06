import { KodiMediaProvider } from "./KodiMediaProvider";
import { ProviderFactory } from "../BaseMediaProvider/ProviderFactory";

export class KodiMediaProviderFactory extends ProviderFactory<KodiMediaProvider> {
    type: string = 'kodi';

    async createFromConfig ( config : any ) : Promise<KodiMediaProvider> {
        return new KodiMediaProvider( config.name, config.address, config.port );
    }
}