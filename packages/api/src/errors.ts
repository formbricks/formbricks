export type NetworkError = {
  code: "network_error";
  message: string;
  status: number;
  url: URL;
};
