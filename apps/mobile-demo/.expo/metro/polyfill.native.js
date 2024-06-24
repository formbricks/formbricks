global.$$require_external = (moduleId) => {
  throw new Error(
    `Node.js standard library module ${moduleId} is not available in this JavaScript environment`
  );
};
