export interface TimeZoneOption {
  value: string;
  offsetLabel: string;
  compactOffsetLabel: string;
  offsetMinutes: number;
  longName: string;
  city: string;
  searchLabel: string;
}

export interface TimeZoneDateParts {
  year: number;
  month: number;
  day: number;
}
