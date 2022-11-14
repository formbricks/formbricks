/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://formbricks.com",
  generateRobotsTxt: true, // (optional)
};
