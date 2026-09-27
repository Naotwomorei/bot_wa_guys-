const axios = require("axios");

function extractVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function scrape(url, format = "mp4") {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    // Menggunakan endpoint API publik alternatif yang lebih stabil
    const targetUrl = `https://api.vkrdev.eu.org/api/v2/yt${format === "mp3" ? "mp3" : "mp4"}?url=https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      timeout: 15000
    });

    const data = response.data;
    if (!data || (!data.downloadUrl && !data.link && !data.url)) {
      throw new Error("Failed to retrieve download link from server.");
    }

    const finalDownloadURL = data.downloadUrl || data.link || data.url;

    return {
      status: true,
      result: {
        title: data.title || "YouTube Video",
        downloads: [
          {
            type: format === "mp3" ? "audio" : "video",
            quality: format === "mp3" ? "320kbps" : "720p",
            url: finalDownloadURL
          }
        ]
      },
    };
  } catch (error) {
    return {
      status: false,
      message: error.message,
    };
  }
}

module.exports = { scrape, extractVideoId };