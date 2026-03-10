module.exports = {
  apps: [
    {
      name: "board-web",
      cwd: "/var/www/board-briefing-desk/current",
      script: "npm",
      args: "run start -- --port 3000",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "board-helper",
      cwd: "/var/www/board-briefing-desk/current",
      script: "npm",
      args: "run importer:helper",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
