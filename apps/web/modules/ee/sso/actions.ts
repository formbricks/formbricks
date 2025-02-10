"use server";

import jackson from "./lib/jackson";

export const createConnectionAction = async () => {
  const { connectionController } = await jackson();

  const createdConnection = await connectionController.createSAMLConnection({
    tenant: "formbricks.com",
    product: "formbricks.com",
    redirectUrl: ["http://localhost:3000/*"],
    defaultRedirectUrl: "http://localhost:3000/api/auth/saml/callback",
    rawMetadata: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://www.okta.com/exknb0ngns4WRpIdQ5d7">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
  <md:KeyDescriptor use="signing">
  <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:X509Data>
  <ds:X509Certificate>MIIDqDCCApCgAwIBAgIGAZTp95zaMA0GCSqGSIb3DQEBCwUAMIGUMQswCQYDVQQGEwJVUzETMBEG A1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEU MBIGA1UECwwLU1NPUHJvdmlkZXIxFTATBgNVBAMMDGRldi0xMDk5MjM5NDEcMBoGCSqGSIb3DQEJ ARYNaW5mb0Bva3RhLmNvbTAeFw0yNTAyMDkwOTA3MjZaFw0zNTAyMDkwOTA4MjZaMIGUMQswCQYD VQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsG A1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxFTATBgNVBAMMDGRldi0xMDk5MjM5NDEc MBoGCSqGSIb3DQEJARYNaW5mb0Bva3RhLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC ggEBALcMLHfmc1MBlD5BEk/C1qKT27gxD7jFnPdDSZ6hQFPEvTH5OyczJpq2fG7FCyyBSMtvCGaL QB05GHAFDIXOrIYA4FhBPQWtK1HlNzR1yi6MnaeEJ6lzflXhJQqFX0mF7+0Hx8CnHPjJQz+v30EY DN8FVzRgrND1C8mdVs5QAjOguSDJxVbpEa6ZBdu70BwEAQvgoTW8dkhVD6T84H/hyg/qnKjT3Ds2 o3pXPgwJ9+L/VzpuRhUwrqJXGJFSZaPUct7CasPXRO+2stcrI2piq+XV7vPI6TaGrwszJz7K7dpW 2dirKf1SLyka2EI039n4vWkMmPdqjtfEvFz4cNsGZ2UCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEA XE2cqQXsLTDqxIwT5Kke3DPdoaDUeionzltz5cM1ai95Q+0yxa3LaAIyG+HlUrPKkVajAeT6iDuZ ALwOptilhVKIyborMgyuujxJKe4Htgq93gSYZTkMkwCUHkQ//5LV7cxhddk9Y70bCLl2rT1KVMWI 3BeFRdCIKNE+7sq5+DTnjmoqDDv2QpPev+7efvRigVgOGTfMyK+uBQ946s5EpEayEMJYCz1bDOji xSSnGM6paFnPzDuA+MInvxp7ntfj3rwOvGMJmqjLQgPW3e3eOX7te0daHUtxl4tlfuPlqq9mdNsV YO6pYZh9kjC4EX+mY4qfEObmoGEJHKkv2yjFnA==</ds:X509Certificate>
  </ds:X509Data>
  </ds:KeyInfo>
  </md:KeyDescriptor>
  <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
  <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://dev-10992394.okta.com/app/dev-10992394_samlfb_1/exknb0ngns4WRpIdQ5d7/sso/saml"/>
  <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://dev-10992394.okta.com/app/dev-10992394_samlfb_1/exknb0ngns4WRpIdQ5d7/sso/saml"/>
  </md:IDPSSODescriptor>
  </md:EntityDescriptor>`,
  });
  console.log(createdConnection);
};

export const deleteConnectionAction = async () => {
  console.log("deleteConnectionAction");
  const { connectionController } = await jackson();
  await connectionController.deleteConnections({
    tenant: "formbricks.com",
    product: "formbricks.com",
  });
};

export const getConnectionsAction = async () => {
  console.log("getConnectionsAction");
  const { connectionController } = await jackson();
  const connections = await connectionController.getConnections({
    tenant: "formbricks.com",
    product: "formbricks.com",
  });
  console.log(connections);
};
