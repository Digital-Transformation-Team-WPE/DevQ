export const config = {
  server: "(localdb)\\MSSQLLocalDB",
  database: "RobotLib",
  authentication: {
    type: "default"
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000
  }
};
