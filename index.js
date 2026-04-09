require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");
const puppeteer = require("puppeteer-core");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// store seen jobs (avoid duplicates)
let seenJobs = new Set();

// 🔔 send telegram message
async function sendTelegramMessage(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
    });
  } catch (error) {
    console.error("Telegram Error:", error.message);
  }
}

// 🚀 scrape Microsoft jobs (working version)


async function fetchMicrosoftJobs() {
  try {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.goto(
      "https://apply.careers.microsoft.com/careers?domain=microsoft.com&location=India&sort_by=timestamp",
      { waitUntil: "domcontentloaded" }
    );

    await new Promise(r => setTimeout(r, 5000));

    const jobs = await page.evaluate(() => {
      const links = document.querySelectorAll("a[href*='/job/']");
      let data = [];

      links.forEach(link => {
        const title = link.innerText.trim();
        const href = link.href;

        if (title && href) {
          data.push({ title, link: href });
        }
      });

      return data;
    });

    await browser.close();
    return jobs;

  } catch (error) {
    console.error("Error scraping:", error.message);
    return [];
  }
}
// 🔁 main logic
async function checkJobs() {
    console.log("Checking for new jobs...");
  
    const jobs = await fetchMicrosoftJobs();
    console.log("Total jobs fetched:", jobs.length);
  
    // ✅ Step 1: Filter SDE2
    const filteredJobs = jobs.filter(job => {
        const title = job.title.toLowerCase();
      
        return (
          /software engineer/.test(title) &&
          (
            /\bii\b/.test(title) ||   // matches " II " only
            /\b2\b/.test(title)       // matches " 2 "
          )
        );
      });
  
    console.log("Filtered jobs:", filteredJobs.length);
  
    // ✅ Step 2: Take only latest jobs
    const latestJobs = filteredJobs.slice(0, 5);
  
    // ✅ Step 3: Loop over latest jobs
    for (let job of latestJobs) {
      const jobId = job.link;
  
      if (!seenJobs.has(jobId)) {
        seenJobs.add(jobId);
  
        const message = `
  🚀 New Microsoft Job!
  
  Title: ${job.title}
  Link: ${job.link}
        `;
  
        console.log("New Job Found:", job.title);
  
        await sendTelegramMessage(message);
      }
    }
  }

// 🔥 run immediately
checkJobs();

// 🔁 run every 5 minutes
cron.schedule("*/5 * * * *", checkJobs);

console.log("🚀 Job Notifier Started...");