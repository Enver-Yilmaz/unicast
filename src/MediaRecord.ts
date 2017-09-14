import { MediaSourceDetails } from "./MediaProviders/MediaSource";

export enum MediaKind {
    Movie = 'movie',
    TvShow = 'show',
    TvSeason = 'season',
    TvEpisode = 'episode',
    Custom = 'custom'
}

export var AllMediaKinds : MediaKind[] = [
    MediaKind.Movie,
    MediaKind.TvShow,
    MediaKind.TvSeason,
    MediaKind.TvEpisode,
    MediaKind.Custom
];

export type ExternalReferences = { [ key : string ] : string };

export interface MediaRecordArt {
    thumbnail : string;
    poster : string;
    background : string;
    banner : string;
}

export interface TvSeasonMediaRecordArt extends MediaRecordArt {
    tvshow : MediaRecordArt;
}

export interface PlayableQualityRecord {
    source : string;
    resolution : string;
    releaseGroup : string;
    codec : string;
}

export interface MediaRecord {
    id : string;
    internalId : string;
    repository : string;
    kind : MediaKind;
    title : string;
    art : MediaRecordArt;
    external : ExternalReferences;
}

export interface PlayableMediaRecord extends MediaRecord {
    runtime : number;
    sources : MediaSourceDetails[];
    quality : PlayableQualityRecord;
    playCount : number;
    watched : boolean;
    lastPlayed : Date;
    addedAt : Date;
}

export interface MovieMediaRecord extends PlayableMediaRecord {
    rating : number;
    genres : string[];
    trailer : string;
    parentalRating : string;
    plot : string;
    year : number;
    tagline : string;
}

export interface TvShowMediaRecord extends MediaRecord {
    episodesCount : number;
    genres : string[];
    plot : string;
    parentalRating : string;
    rating : number;
    seasonsCount : number;
    year : number;
    watchedEpisodesCount : number;
    watched : boolean;
    addedAt : Date;
}

export interface TvSeasonMediaRecord extends MediaRecord {
    art : TvSeasonMediaRecordArt;
    number : number;
    tvShowId : string;
    episodesCount : number;
    watchedEpisodesCount : number;
}

export interface TvEpisodeMediaRecord extends PlayableMediaRecord {
    number : number;
    seasonNumber : number;   
    tvSeasonId : string;
    rating : number;
}

export interface CustomMediaRecord extends PlayableMediaRecord {

}