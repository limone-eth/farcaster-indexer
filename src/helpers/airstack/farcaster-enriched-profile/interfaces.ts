export interface Image {
  extraSmall: string;
  large: string;
  medium: string;
  small: string;
}

export interface TokenNFT {
  address: string;
  tokenId: string;
  contentValue: {
    image: Image;
  };
}

export interface Social {
  profileName: string;
  userId: string;
}

export interface Owner {
  socials: Social[];
}

export interface TokenBalance {
  owner: Owner;
  tokenNfts: TokenNFT[];
}

export interface EthereumNFTData {
  EthereumNFT: {
    TokenBalance: TokenBalance[];
  };
}

export interface PolygonNFTData {
  PolygonNFT: {
    TokenBalance: TokenBalance[];
  };
}

export interface PoapEventImage {
  extraSmall: string;
  large: string;
  medium: string;
  original: string;
  small: string;
}

export interface PoapEvent {
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
  owner: Owner;
  eventId: number;
  poapEvent: PoapEvent;
}

export interface POAPsData {
  Poap: Poap[];
}

export interface FarcasterUserPOAPsAndNFTsResult {
  EthereumNFT: EthereumNFTData;
  PolygonNFT: PolygonNFTData;
  POAPs: POAPsData;
}

export interface FarcasterUserPOAPsAndNFTsVariables {
  farcasterFids: string[];
}
