import init from "honeycomb-beeline";

if (process.env.HONEYCOMB_API_KEY) {
  init({
    writeKey: process.env.HONEYCOMB_API_KEY,
    dataset: "backend",
    serviceName: "jsfarm"
  });
}
