
export interface PoapEventImage {
    extraSmall: string;
    large: string;
    medium: string;
    original: string;
    small: string;
}

export interface PoapEvent {
    eventId: string;
    eventName: string;
    eventURL: string;
    startDate: string;
    endDate: string;
    country: string;
    city: string;
    contentValue: {
        image: PoapEventImage;
    };
}

export interface Poap {
    eventId: number;
    poapEvent: PoapEvent;
}

export interface POAPsData {
    Poap: Poap[];
}
export interface POAPsResult {
    POAPs: POAPsData;
}
