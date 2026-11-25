import { defineRailway, github, project, service, volume } from "railway/iac";

export const partial = "synthworx-site";

export default defineRailway(() => {
  const synthworxSiteVolume = volume("synthworx-site-volume", {
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    allowOnlineResize: true,
    region: "asia-southeast1-eqsg3a",
    sizeMB: 5000,
  });
  const synthworxSite = service("synthworx-site", {
    source: github("shaihazher/synthworx-web", { branch: "main", checkSuites: false }),
    build: {
      builder: "NIXPACKS",
      buildEnvironment: "V3",
      buildCommand: "npm run build",
    },
    deploy: {
      startCommand: "npm run start",
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
      runtime: "V2",
      useLegacyStacker: false,
      ipv6EgressEnabled: false,
    },
    replicas: { "asia-southeast1-eqsg3a": 1 },
    networking: {
      customDomains: { "synthworx.com": {}, "www.synthworx.com": {} },
      serviceDomains: { "synthworx-site-production.up.railway.app": {} },
    },
    volumeMounts: { "/data": synthworxSiteVolume },
  });

  return project("synthworx-site", {
    variables: { managed: false },
    resources: [synthworxSite, synthworxSiteVolume],
  });
});
