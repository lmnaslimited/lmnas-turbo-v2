module.exports = ({ env }) => {
  return {
    graphql: {
      enabled: true,
      config: {
        endpoint: "/graphql",
        shadowCRUD: true,
        defaultLimit: 100,
        maxLimit: 100,
        v4CompatibilityMode: false,
        apolloServer: {
          introspection: true
        }
      }
    }
  };
};
