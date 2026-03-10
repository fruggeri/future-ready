module.exports = {
  apps: [
    {
      name: "board-web",
      cwd: "/var/www/board-briefing-desk/current",
      script: "npm",
      args: "run start -- --port 3000",
      env: {
        NODE_ENV: "production",
        FUTUREREADY_DATA_DIR: "/var/www/board-briefing-desk/data",
        FUTUREREADY_DATA_DB: "/var/www/board-briefing-desk/data/futureready.sqlite",
      },
    },
    {
      name: "board-helper",
      cwd: "/var/www/board-briefing-desk/current",
      script: "npm",
      args: "run importer:helper",
      env: {
        NODE_ENV: "production",
        FUTUREREADY_DATA_DIR: "/var/www/board-briefing-desk/data",
        FUTUREREADY_DATA_DB: "/var/www/board-briefing-desk/data/futureready.sqlite",
        FUTUREREADY_HELPER_HOST: "0.0.0.0",
        FUTUREREADY_HELPER_PORT: "4318",
      },
    },
  ],
};
