export type Priority = "Primary" | "Secondary" | "Tertiary";

export type Target = {
  id: string;
  priority: Priority;
  name: string;
  category: string;
  city: string;
  county: string;
  state: string;
  lat: number;
  lon: number;
  multiple: boolean;
  notes: string;
};

export type Shelter = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  capacity: number | null;
  org: string;
  lat: number;
  lon: number;
};

export type DataCenter = {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  scale: string;
  note: string;
};

export type Band = "worst" | "severe" | "elevated" | "moderate" | "lower";

export type Region = {
  id: string;
  name: string;
  band: "worst" | "severe" | "lower";
  kind: "target-zone" | "fallout" | "relative";
  why: string;
  ring: number[][];
};

export type Place = {
  name: string;
  state: string;
  lat: number;
  lon: number;
};

export type Catalog = {
  generated: string;
  shelterSnapshot: string;
  shelterSource: string;
  targets: Target[];
  shelters: Shelter[];
  datacenters: DataCenter[];
  regions: Region[];
  places: Place[];
};

export type Layers = {
  primary: boolean;
  secondary: boolean;
  tertiary: boolean;
  datacenters: boolean;
  shelters: boolean;
  fallout: boolean;
  zones: boolean;
};

export type Picked =
  | { kind: "target"; id: string }
  | { kind: "shelter"; id: string }
  | { kind: "datacenter"; id: string }
  | { kind: "region"; id: string }
  | { kind: "place"; name: string; state: string };
