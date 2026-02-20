module.exports = ({ env }) => {
  const client = env("DATABASE_CLIENT", "postgres");

  return {
    connection: {
      client,
      connection: {
        host: env("DATABASE_HOST", "postgres"),
        port: env.int("DATABASE_PORT", 5432),
        database: env("DATABASE_NAME", "lmnas"),
        user: env("DATABASE_USERNAME", "lmnas"),
        password: env("DATABASE_PASSWORD", "lmnas"),
        ssl: env.bool("DATABASE_SSL", false)
      }
    }
  };
};
