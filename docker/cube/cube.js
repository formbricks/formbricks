module.exports = {
  // queryRewrite runs before every Cube query. Use it to enforce row-level security (RLS)
  // by injecting filters based on the caller's identity (e.g. organizationId, projectId).
  //
  // The securityContext is populated from the decoded JWT passed via the API token.
  // Currently a passthrough because access control is handled in the Next.js API layer
  // before reaching Cube. When Cube is exposed more broadly or multi-tenancy enforcement
  // is needed at the Cube level, add filters here based on securityContext claims.
  queryRewrite: (query, { securityContext }) => {
    return query;
  },
};
