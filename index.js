const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Pastikan package form-data sudah terinstall di node_modules

// Panggil Master Scraper dari file scraper.js
const scraper = require('./scraper');

// =========================================================================
// 📌 KONFIGURASI MULTI-GRUP & DATABASE LEVELING
// =========================================================================
const GROUP_LIMITED = '120363426460671438@g.us'; // Grup Utama (Obrolan & Downloader Standar)
const GROUP_ANOTHER = '120363430375282152@g.us'; // Grup Khusus Multimedia (BG Remover & HD Foto)

const DB_FILE = './database_leveling.json';

// Baca atau Buat Database JSON Otomatis
let userDB = {};
if (fs.existsSync(DB_FILE)) {
    userDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

// Fungsi Simpan Data ke File JSON
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(userDB, null, 2));
}

// Memory / Objek Sementara untuk Cooldown Chat (3 Detik)
const cooldownXP = {};

// =========================================================================
// 🎮 LOGIKA EFEK LEVELING & XP
// =========================================================================
async function tambahXP(sock, from, userJid, jumlahXP, quotedMsg) {
    if (!userDB[userJid]) {
        userDB[userJid] = { xp: 0, level: 1 };
    }

    userDB[userJid].xp += jumlahXP;
    let xpDibutuhkan = userDB[userJid].level * 100;

    // Cek Apakah Pengguna Level Up!
    if (userDB[userJid].xp >= xpDibutuhkan) {
        userDB[userJid].level += 1;
        userDB[userJid].xp -= xpDibutuhkan;

        const userTag = userJid.split('@')[0];
        const pesanLevelUp = `🎉 *LEVEL UP!* 🎉\n\nSelamat @${userTag}! 🥳\nLevel kamu naik menjadi: *Level ${userDB[userJid].level}*\n\nTerus aktif di grup buat naikin level lagi! 🚀`;

        await sock.sendMessage(from, {
            text: pesanLevelUp,
            mentions: [userJid]
        }, { quoted: quotedMsg });
    }

    saveDB();
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log('\n======================================================');
            console.log('🔗 BUKA LINK INI DI BROWSER BUAT SCAN QR CODE:');
            console.log(qrImageUrl);
            console.log('======================================================\n');
        }

        if (connection === 'open') {
            console.log('✅ BOT BERHASIL TERHUBUNG & AKTIF (MULTI-GROUP & REAL BG REMOVER READY)!');
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== 401;
            console.log('🔄 Koneksi terputus, mencoba menghubungkan kembali:', shouldReconnect);
            
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('⚠️ Sesi terhapus atau logout. Silakan hapus folder auth_info dan scan QR baru.');
            }
        }
    });

    // =========================================================================
    // 1. FITUR WELCOME MESSAGE (Berlaku di Semua Grup Terdaftar)
    // =========================================================================
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;

        if ((id === GROUP_LIMITED || id === GROUP_ANOTHER) && action === 'add') {
            for (const participant of participants) {
                const userJid = typeof participant === 'string' ? participant : (participant.id || participant.jid || '');
                if (!userJid) continue;

                const captionText = `@${userJid.split('@')[0]} ╭── [ 🌸 A.P.A INTRO 🌸 ] ──
✦ 𝑷𝒆𝒓𝒌𝒆𝒏𝒂𝒍𝒂𝒏 𝑨𝒏𝒈𝒈𝒐𝒕𝒂 ✦
╰━━━━━━━━━━━━━━━━━━━━━━╯

୨୧ Nama : 
୨୧ Gender : 
୨୧ Kelas : 
୨୧ Anime Favorit : 
୨୧ Waifu / Husbu : 

╭─────────── ✦ ───────────╮
🎌 𝗦𝗮𝗹𝗮𝗺 𝗞𝗲𝗻𝗮𝗹! 🎌
Semoga betah di keluarga anime ini ♡
╰─────────── ✦ ───────────╯

🌸 𝗬𝗼𝗿𝗼𝘀𝗵𝗶 𝗢𝗻𝗲𝗴𝗮𝗶𝘀𝗵𝗶𝗺𝗮𝘀𝘂! 🌸`;

                const imagePath = path.join(__dirname, 'gambar.jpeg');

                try {
                    if (fs.existsSync(imagePath)) {
                        await sock.sendMessage(id, {
                            image: fs.readFileSync(imagePath),
                            caption: captionText,
                            mentions: [userJid]
                        });
                    } else {
                        await sock.sendMessage(id, {
                            text: captionText,
                            mentions: [userJid]
                        });
                    }
                } catch (err) {
                    console.error('Gagal mengirim pesan welcome:', err);
                }
            }
        }
    });

    // =========================================================================
    // 2. FITUR UTAMA BOT (MESSAGES UPSERT)
    // =========================================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const userJid = msg.key.participant || msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            // =========================================================================
            // A. FITUR CEK LIST GRUP (Bisa diketik di CHAT PRIBADI bot)
            // =========================================================================
            if (!from.endsWith('@g.us') && (text.toLowerCase() === '.listgrup' || text.toLowerCase() === '.mygroups')) {
                try {
                    const fetchedGroups = await sock.groupFetchAllParticipating();
                    const groupsArray = Object.values(fetchedGroups);

                    if (groupsArray.length === 0) {
                        await sock.sendMessage(from, { text: '❌ Bot belum bergabung di grup manapun.' }, { quoted: msg });
                        return;
                    }

                    let responseText = `📋 *DAFTAR GRUP WHATSAPP BOT* (${groupsArray.length} Grup):\n\n`;

                    groupsArray.forEach((group, index) => {
                        responseText += `${index + 1}. *${group.subject}*\n`;
                        responseText += `   🆔 ID: \`${group.id}\`\n\n`;
                    });

                    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
                } catch (err) {
                    console.error('Gagal mengambil daftar grup:', err);
                    await sock.sendMessage(from, { text: '⚠️ Terjadi kesalahan saat mengambil daftar grup.' }, { quoted: msg });
                }
                return;
            }

            // 🔒 FILTER UTAMA: Hanya proses pesan grup jika berasal dari grup terdaftar!
            if (from !== GROUP_LIMITED && from !== GROUP_ANOTHER) return;

            // 🚫 FILTER 1: Jika pesan berupa Stiker, abaikan perhitungan XP
            const isSticker = msg.message.stickerMessage;
            if (isSticker) return;

            // =========================================================================
            // B1. FITUR REAL BACKGROUND REMOVER (GROUP_ANOTHER)
            // =========================================================================
            const cmd = text.toLowerCase().trim();
            if (from === GROUP_ANOTHER && (cmd === '.bg' || cmd === '!bg')) {
                const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
                const hasMedia = msg.message.imageMessage || quotedMsgInfo?.quotedMessage?.imageMessage;

                if (!hasMedia) {
                    await sock.sendMessage(from, { text: `⚠️ Kirim atau balas foto sambil mengetik *.bg* untuk menghapus background secara nyata!` }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `⏳ *[AI BG Remover]* Sedang menghapus background foto, tunggu sebentar ya...`, mentions: [userJid] }, { quoted: msg });

                try {
                    let targetMsg = msg;
                    if (quotedMsgInfo?.quotedMessage?.imageMessage) {
                        targetMsg = {
                            key: {
                                remoteJid: from,
                                id: quotedMsgInfo.stanzaId,
                                participant: quotedMsgInfo.participant
                            },
                            message: quotedMsgInfo.quotedMessage
                        };
                    }

                    // Download buffer gambar
                    const mediaBuffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });

                    if (!mediaBuffer) {
                        await sock.sendMessage(from, { text: `❌ Gagal mengunduh gambar.` }, { quoted: msg });
                        return;
                    }

                    const apiKey = process.env.REMOVE_BG_API_KEY;
                    if (!apiKey) {
                        await sock.sendMessage(from, { text: `⚠️ *REMOVE_BG_API_KEY* belum diset di Railway Variables kamu! Silakan daftar gratis di remove.bg lalu masukkan kuncinya.` }, { quoted: msg });
                        return;
                    }

                    // Kirim ke API Remove.bg
                    const form = new FormData();
                    form.append('image_file', mediaBuffer, { filename: 'input.jpg' });
                    form.append('size', 'auto');

                    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                        method: 'POST',
                        headers: {
                            'X-Api-Key': apiKey,
                            ...form.getHeaders()
                        },
                        body: form
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        console.error('Remove.bg Error:', errText);
                        await sock.sendMessage(from, { text: `❌ Gagal memproses background. Pastikan API Key remove.bg kamu valid.` }, { quoted: msg });
                        return;
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    const resultBuffer = Buffer.from(arrayBuffer);

                    await sock.sendMessage(from, { 
                        image: resultBuffer, 
                        caption: `✅ *Background Berhasil Dihapus!* ✂️\n👤 @${userJid.split('@')[0]}`,
                        mentions: [userJid]
                    }, { quoted: msg });

                    await tambahXP(sock, from, userJid, 25, msg);
                } catch (err) {
                    console.error('Error Real BG Remover:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan pada sistem pemrosesan background.` }, { quoted: msg });
                }
                return;
            }

            const cleanUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];

            // =========================================================================
            // F. COMMAND MENU / BANTUAN
            // =========================================================================
            if (
                text.toLowerCase() === '!menu' || 
                text.toLowerCase() === '.menu' || 
                text.toLowerCase() === '!help' ||
                text.toLowerCase() === '.help'
            ) {
                let menuText = `🤖 *DAFTAR FITUR BOT A.P.A* 🤖

Halo @${userJid.split('@')[0]}! Berikut adalah daftar perintah yang bisa kamu gunakan:

✨ *GROQ AI (AKTIF)*
▫️ \`.meta [pertanyaan]\` atau \`.ai [pertanyaan]\` — Tanya jawab AI cerdas.

📊 *SISTEM LEVELING & XP*
▫️ \`!level\` atau \`.level\` — Cek level & XP kamu.
▫️ \`!top\` atau \`.leaderboard\` — Cek 5 besar member.

📥 *MULTI-PLATFORM DOWNLOADER*
Kirim link YouTube MP3, TikTok, IG, FB, atau Pinterest untuk unduh media otomatis (+25 XP)!`;

                if (from === GROUP_ANOTHER) {
                    menuText += `\n\n✂️ *FITUR MULTIMEDIA KHUSUS*\n▫️ \`.bg\` — Hapus latar belakang foto secara nyata.`;
                }

                await sock.sendMessage(from, { 
                    text: menuText, 
                    mentions: [userJid] 
                }, { quoted: msg });
                
                return;
            }

            // =========================================================================
            // G. FITUR GROQ AI (AKTIF DI SEMUA GRUP)
            // =========================================================================
            const isCommandMeta = text.toLowerCase().startsWith('.meta') || text.toLowerCase().startsWith('.ai');
            const isTaggedBot = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id);

            if (isCommandMeta || isTaggedBot) {
                let pertanyaan = text;
                if (text.toLowerCase().startsWith('.meta')) {
                    pertanyaan = text.slice(5).trim();
                } else if (text.toLowerCase().startsWith('.ai')) {
                    pertanyaan = text.slice(3).trim();
                }

                if (!pertanyaan) {
                    await sock.sendMessage(from, { text: `Apasih @${userJid.split('@')[0]}? Ketik \`.meta [pertanyaan kamu]\` napa! 🗿` }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `⚡ AI lagi mikir buat @${userJid.split('@')[0]}...`, mentions: [userJid] }, { quoted: msg });
                await sock.sendPresenceUpdate('composing', from);
                
                try {
                    const apiKey = process.env.GROQ_API_KEY;
                    if (!apiKey) {
                        await sock.sendMessage(from, { text: '⚠️ API Key Groq belum diset di Railway!' }, { quoted: msg });
                        return;
                    }

                    const systemPrompt = "Lu adalah asisten AI yang sangat cerdas, kritis, tapi tetap asik dan santai pakai bahasa gaul Gen Z (lu-gue).";

                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: "openai/gpt-oss-120b",
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: pertanyaan }
                            ],
                            temperature: 0.7
                        })
                    });

                    const data = await response.json();
                    
                    if (data.error) {
                        await sock.sendMessage(from, { text: `⚠️ AI Error: ${data.error.message}` }, { quoted: msg });
                        return;
                    }

                    let jawabanAI = data.choices?.[0]?.message?.content || "Gagal merespons.";
                    const balasanFinal = `🤖 *[GROQ AI]*\n\n${jawabanAI}\n\n_— @${userJid.split('@')[0]}_`;

                    await sock.sendMessage(from, { text: balasanFinal, mentions: [userJid] }, { quoted: msg });
                } catch (err) {
                    console.error('Gagal memanggil Groq API:', err);
                }
                return;
            }

            // =========================================================================
            // H. DOWNLOADER YOUTUBE MP3
            // =========================================================================
            if (cleanUrl && (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be'))) {
                await sock.sendMessage(from, { text: `⏳ *[YouTube MP3]*\nSabar bree, bot lagi proses convert audio...`, mentions: [userJid] }, { quoted: msg });

                try {
                    const resData = await scraper.youtube.ytmp3(cleanUrl, "mp3");

                    if (resData && resData.status && resData.result?.downloads?.[0]?.url) {
                        const audioUrl = resData.result.downloads[0].url;
                        const audioTitle = resData.result.title || 'YouTube Audio';

                        await sock.sendMessage(from, { 
                            audio: { url: audioUrl }, 
                            mimetype: 'audio/mp4',
                            ptt: false,
                            caption: `🎵 *Berhasil!* Lagu *${audioTitle}* diunduh.\n👤 @${userJid.split('@')[0]}`
                        }, { quoted: msg });

                        await tambahXP(sock, from, userJid, 25, msg);
                    } else {
                        await sock.sendMessage(from, { text: `❌ Gagal mengkonversi audio.` }, { quoted: msg });
                    }
                } catch (err) {
                    console.error('Error Local YTMP3:', err);
                }
                return;
            }

            // =========================================================================
            // I. DOWNLOADER TIKTOK
            // =========================================================================
            if (cleanUrl && cleanUrl.includes('tiktok.com')) {
                await sock.sendMessage(from, { text: '⏳ *[TikTok Downloader]* Sedang mengunduh...' }, { quoted: msg });
                try {
                    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                    const json = await res.json();

                    if (json.data) {
                        if (json.data.play) {
                            await sock.sendMessage(from, { video: { url: json.data.play }, caption: `✅ TikTok Video` }, { quoted: msg });
                        } else if (json.data.images?.length > 0) {
                            for (const imgUrl of json.data.images) {
                                await sock.sendMessage(from, { image: { url: imgUrl } }, { quoted: msg });
                            }
                        }
                        await tambahXP(sock, from, userJid, 25, msg);
                    }
                } catch (e) {
                    console.error('Error TikTok:', e);
                }
                return;
            }

            // =========================================================================
            // J. DOWNLOADER INSTAGRAM (VIA SCRAPER LOKAL)
            // =========================================================================
            if (cleanUrl && cleanUrl.includes('instagram.com')) {
                await sock.sendMessage(from, { text: `⏳ *[Instagram Downloader]* Sedang memproses...`, mentions: [userJid] }, { quoted: msg });
                try {
                    const resData = await scraper.instagram(cleanUrl);
                    const mediaUrl = resData?.result || resData?.url || resData?.[0];

                    if (mediaUrl) {
                        const isVideo = mediaUrl.includes('.mp4') || cleanUrl.includes('/reel/');
                        if (isVideo) {
                            await sock.sendMessage(from, { video: { url: mediaUrl }, caption: `✅ Instagram Video / Reel berhasil!` }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { image: { url: mediaUrl }, caption: `✅ Instagram Foto berhasil!` }, { quoted: msg });
                        }
                        await tambahXP(sock, from, userJid, 25, msg);
                    } else {
                        await sock.sendMessage(from, { text: `❌ Gagal mengambil media Instagram.` }, { quoted: msg });
                    }
                } catch (err) {
                    console.error('Error Instagram Scraper:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan pada scraper Instagram.` }, { quoted: msg });
                }
                return;
            }

            // =========================================================================
            // K. DOWNLOADER FACEBOOK & PINTEREST (VIA SCRAPER LOKAL)
            // =========================================================================
            if (cleanUrl && (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch'))) {
                await sock.sendMessage(from, { text: `⏳ *[Facebook Downloader]* Memproses...`, mentions: [userJid] }, { quoted: msg });
                try {
                    const resData = await scraper.facebook(cleanUrl);
                    const mediaUrl = resData?.result || resData?.url;
                    if (mediaUrl) {
                        await sock.sendMessage(from, { video: { url: mediaUrl }, caption: `✅ Facebook Video berhasil!` }, { quoted: msg });
                        await tambahXP(sock, from, userJid, 25, msg);
                    } else {
                        await sock.sendMessage(from, { text: `❌ Gagal mengunduh video Facebook.` }, { quoted: msg });
                    }
                } catch (err) {
                    console.error('Error FB Scraper:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan pada scraper Facebook.` }, { quoted: msg });
                }
                return;
            }

            if (cleanUrl && (cleanUrl.includes('pin.it') || cleanUrl.includes('pinterest.com'))) {
                await sock.sendMessage(from, { text: `⏳ *[Pinterest Downloader]* Memproses...`, mentions: [userJid] }, { quoted: msg });
                try {
                    const resData = await scraper.pinterest(cleanUrl);
                    const mediaUrl = resData?.result || resData?.url;
                    if (mediaUrl) {
                        await sock.sendMessage(from, { image: { url: mediaUrl }, caption: `✅ Pinterest Media berhasil!` }, { quoted: msg });
                        await tambahXP(sock, from, userJid, 25, msg);
                    } else {
                        await sock.sendMessage(from, { text: `❌ Gagal mengunduh dari Pinterest.` }, { quoted: msg });
                    }
                } catch (err) {
                    console.error('Error Pinterest Scraper:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan pada scraper Pinterest.` }, { quoted: msg });
                }
                return;
            }

            // =========================================================================
            // L. COMMAND LEVEL & LEADERBOARD
            // =========================================================================
            if (text.toLowerCase() === '!level' || text.toLowerCase() === '.level') {
                const userData = userDB[userJid] || { xp: 0, level: 1 };
                const targetXP = userData.level * 100;
                const userTag = userJid.split('@')[0];

                const statusLevel = `📊 *INFORMASI LEVEL*\n\n👤 @${userTag}\n⭐ Level: *${userData.level}*\n⚡ XP: *${userData.xp} / ${targetXP} XP*`;
                await sock.sendMessage(from, { text: statusLevel, mentions: [userJid] }, { quoted: msg });
                return;
            }

            if (text.toLowerCase() === '!top' || text.toLowerCase() === '.top' || text.toLowerCase() === '!leaderboard') {
                const sortedUsers = Object.keys(userDB).map(jid => ({ jid, ...userDB[jid] }))
                    .sort((a, b) => b.level === a.level ? b.xp - a.xp : b.level - a.level);

                const top5 = sortedUsers.slice(0, 5);
                if (top5.length === 0) {
                    await sock.sendMessage(from, { text: '❌ Belum ada data level.' }, { quoted: msg });
                    return;
                }

                let textLeaderboard = `🏆 *TOP 5 LEADERBOARD* 🏆\n\n`;
                const mentionsList = [];

                top5.forEach((user, index) => {
                    const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
                    const tagNumber = user.jid.split('@')[0];
                    textLeaderboard += `${rankEmoji} *@${tagNumber}*\n    └ 🏅 Level: *${user.level}* | ⚡ XP: *${user.xp}*\n\n`;
                    mentionsList.push(user.jid);
                });

                await sock.sendMessage(from, { text: textLeaderboard, mentions: mentionsList }, { quoted: msg });
                return;
            }

            // =========================================================================
            // M. COOLDOWN XP CHAT BIASA (+10 XP)
            // =========================================================================
            const now = Date.now();
            const cooldownTime = 3000; 

            if (cooldownXP[userJid] && (now - cooldownXP[userJid]) < cooldownTime) {
                return; 
            }

            cooldownXP[userJid] = now;
            await tambahXP(sock, from, userJid, 10, msg);

        } catch (err) {
            console.error('Error Bot Process:', err);
        }
    });
}

startBot();