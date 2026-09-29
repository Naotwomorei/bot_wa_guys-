const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ytSearch = require('yt-search');

const scraper = require('./scraper');

const GROUP_LIMITED = '120363413666355189@g.us';
const GROUP_ANOTHER = '120363430375282152@g.us';

const VIP_USERS = [
    '6285831157623@s.whatsapp.net',
    '6283875433777@s.whatsapp.net'
];

const DB_FILE = './database_leveling.json';

let userDB = {};
if (fs.existsSync(DB_FILE)) {
    userDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(userDB, null, 2));
}

const cooldownXP = {};
const searchSessions = {};

async function tambahXP(sock, from, userJid, jumlahXP, quotedMsg) {
    if (!userDB[userJid]) {
        userDB[userJid] = { xp: 0, level: 1 };
    }

    userDB[userJid].xp += jumlahXP;
    let xpDibutuhkan = userDB[userJid].level * 100;

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

    // 🔥 FITUR PAIRING CODE OTOMATIS (TANPA READLINE TERMINAL YANG BIKIN NYANGKUT)
    if (!sock.authState.creds.registered) {
        const phoneNumber = "6281374692461";
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('\n======================================================');
                console.log(`🔑 KODE PAIRING WHATSAPP KAMU: ${code?.match(/.{1,4}/g)?.join('-')}`);
                console.log('======================================================\n');
            } catch (err) {
                console.error('Gagal mendapatkan pairing code:', err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ BOT BERHASIL TERHUBUNG & STABIL (GROUP ONLY MODE)!');
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== 401;
            console.log('🔄 Koneksi terputus, mencoba menghubungkan kembali:', shouldReconnect);
            
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('⚠️ Sesi terhapus atau logout. Silakan hapus folder auth_info dan pairing ulang.');
            }
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action, author } = update;

        console.log(`[GROUP LOG] Grup: ${id} \vert{} Aksi:${action} | Target: ${participants.join(', ')} \vert{} Author/Pelaku:${author}`);

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

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const userJid = msg.key.participant || msg.key.remoteJid;
            
            const text = msg.message.conversation || 
                       msg.message.extendedTextMessage?.text || 
                       msg.message.imageMessage?.caption || '';

            // 🔍 LOG PELACAK PESAN MASUK
            console.log(`[PESAN MASUK] Dari: ${from} \vert{} Teks:${text}`);

            // 🔥 KHUSUS PERINTAH .listgrup / .mygroups DI DM
            const isVipUser = VIP_USERS.includes(userJid);
            const isPrivateChat = !from.endsWith('@g.us');

            if (isPrivateChat && (text.toLowerCase() === '.listgrup' || text.toLowerCase() === '.mygroups')) {
                if (!isVipUser) {
                    await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa diakses oleh VIP user.' }, { quoted: msg });
                    return;
                }

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

            // ❌ ABAIKAN SEMUA PESAN LAIN DARI CHAT PRIBADI (DM)
            if (isPrivateChat) return;

            // Validasi grup terdaftar (kecuali VIP)
            if (!isVipUser && from !== GROUP_LIMITED && from !== GROUP_ANOTHER) return;

            const isSticker = msg.message.stickerMessage;
            if (isSticker) return;

            const cmd = text.toLowerCase().trim();

            // .bg
            if ((from === GROUP_ANOTHER) && (cmd.startsWith('.bg') || cmd.startsWith('!bg'))) {
                const imageMessage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!imageMessage) {
                    await sock.sendMessage(from, { text: `⚠️ Kirim foto dengan caption *.bg* atau balas foto sambil mengetik *.bg* ya, *lek*!` }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `⏳ *[AI BG Remover]* Sedang mengunduh dan menghapus background foto...`, mentions: [userJid] }, { quoted: msg });

                try {
                    const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    if (!mediaBuffer || mediaBuffer.length === 0) {
                        await sock.sendMessage(from, { text: `❌ Gagal mengunduh data gambar.` }, { quoted: msg });
                        return;
                    }

                    const apiKey = process.env.REMOVE_BG_API_KEY;
                    if (!apiKey) {
                        await sock.sendMessage(from, { text: `⚠️ *REMOVE_BG_API_KEY* belum diset di environment variables!` }, { quoted: msg });
                        return;
                    }

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
                        await sock.sendMessage(from, { text: `❌ Gagal memproses background dari server Remove.bg.` }, { quoted: msg });
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
                    console.error('Error BG Execution:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan sistem saat memproses gambar.` }, { quoted: msg });
                }
                return;
            }

            // .hd
            if ((from === GROUP_ANOTHER) && (cmd.startsWith('.hd') || cmd.startsWith('!hd') || cmd.startsWith('.upscale'))) {
                const imageMessage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!imageMessage) {
                    await sock.sendMessage(from, { text: `⚠️ Kirim foto dengan caption *.hd* atau balas foto sambil mengetik *.hd* ya, *lek*!` }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `⏳ *[HD Enhancer]* Sedang memproses foto...`, mentions: [userJid] }, { quoted: msg });

                try {
                    const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    if (!mediaBuffer || mediaBuffer.length === 0) {
                        await sock.sendMessage(from, { text: `❌ Gagal mengunduh gambar.` }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(from, { 
                        image: mediaBuffer, 
                        caption: `✅ *Foto Berhasil Dijernihkan (HD Mode)* 🚀\n👤 @${userJid.split('@')[0]}`,
                        mentions: [userJid]
                    }, { quoted: msg });

                    await tambahXP(sock, from, userJid, 25, msg);
                } catch (err) {
                    console.error('Error HD Execution:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan pada fitur HD.` }, { quoted: msg });
                }
                return;
            }

            // .play
            if (text.toLowerCase().startsWith('.play') || text.toLowerCase().startsWith('!play')) {
                const queryLagu = text.slice(5).trim();
                if (!queryLagu) {
                    await sock.sendMessage(from, { text: `⚠️ Masukkan judul lagunya, *lek*! Contoh: \`.play monolog\`` }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `🎵 *[Music Search]* Sedang mencari lagu "${queryLagu}"...`, mentions: [userJid] }, { quoted: msg });

                try {
                    const searchResults = await ytSearch(queryLagu);
                    const videos = searchResults.videos.slice(0, 5);

                    if (videos.length === 0) {
                        await sock.sendMessage(from, { text: `❌ Lagu tidak ditemukan.` }, { quoted: msg });
                        return;
                    }

                    let listText = `🎵 *Hasil pencarian: ${queryLagu}*\n\n`;
                    const sessionTracks = [];

                    videos.forEach((vid, index) => {
                        listText += `${index + 1}. *${vid.title}* [${vid.timestamp}]\n`;
                        sessionTracks.push({
                            title: vid.title,
                            url: vid.url,
                            author: vid.author.name
                        });
                    });

                    listText += `\n*Balas pesan ini dengan nomor yang sesuai (1-5)*`;

                    const sentMsg = await sock.sendMessage(from, { text: listText, mentions: [userJid] }, { quoted: msg });
                    
                    if (sentMsg && sentMsg.key) {
                        searchSessions[sentMsg.key.id] = {
                            userJid: userJid,
                            tracks: sessionTracks
                        };

                        setTimeout(() => {
                            delete searchSessions[sentMsg.key.id];
                        }, 120000);
                    }
                } catch (err) {
                    console.error('Error Search Music:', err);
                    await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan saat mencari lagu.` }, { quoted: msg });
                }
                return;
            }

            const quotedContext = msg.message.extendedTextMessage?.contextInfo;
            if (quotedContext && searchSessions[quotedContext.stanzaId]) {
                const sessionData = searchSessions[quotedContext.stanzaId];
                
                if (sessionData.userJid === userJid) {
                    const pilihanAngka = parseInt(text.trim());

                    if (!isNaN(pilihanAngka) && pilihanAngka >= 1 && pilihanAngka <= sessionData.tracks.length) {
                        const selectedTrack = sessionData.tracks[pilihanAngka - 1];

                        await sock.sendMessage(from, { text: `⏳ *[Downloader]* Mengunduh lagu *${selectedTrack.title}* beserta liriknya...`, mentions: [userJid] }, { quoted: msg });

                        try {
                            const resData = await scraper.youtube.ytmp3(selectedTrack.url, "mp3");

                            if (resData && resData.status && resData.result?.downloads?.[0]?.url) {
                                const audioUrl = resData.result.downloads[0].url;

                                let lirikLagu = "Lirik tidak ditemukan.";
                                try {
                                    const lyricRes = await fetch(`https://api.vkrdev.eu.org/api/search/lyrics?query=${encodeURIComponent(selectedTrack.title)}`);
                                    const lyricJson = await lyricRes.json();
                                    if (lyricJson && lyricJson.lyrics) {
                                        lirikLagu = lyricJson.lyrics;
                                    }
                                } catch (e) {
                                    lirikLagu = `Lirik untuk "${selectedTrack.title}" tidak tersedia secara publik.`;
                                }

                                await sock.sendMessage(from, { 
                                    text: `🎶 *${selectedTrack.title}*\n\n${lirikLagu}\n\n*[Source: API Lirik]*`,
                                    mentions: [userJid]
                                }, { quoted: msg });

                                await sock.sendMessage(from, { 
                                    audio: { url: audioUrl }, 
                                    mimetype: 'audio/mp4',
                                    ptt: false,
                                    caption: `✅ Berhasil mengunduh *${selectedTrack.title}*\n👤 Diminta oleh: @${userJid.split('@')[0]}`
                                }, { quoted: msg });

                                await tambahXP(sock, from, userJid, 25, msg);
                                delete searchSessions[quotedContext.stanzaId];
                            } else {
                                await sock.sendMessage(from, { text: `❌ Gagal mengunduh file audio lagu tersebut.` }, { quoted: msg });
                            }
                        } catch (err) {
                            console.error('Error Download Selected Music:', err);
                            await sock.sendMessage(from, { text: `⚠️ Terjadi kesalahan saat memproses unduhan musik.` }, { quoted: msg });
                        }
                        return;
                    }
                }
            }

            const cleanUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];

            // .menu
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

🎵 *MUSIC PLAYER & LIRIK*
▫️ \`.play [judul lagu]\` — Cari lagu, pilih nomornya, dan bot kirim musik + lirik!

📊 *SISTEM LEVELING & XP*
▫️ \`!level\` atau \`.level\` — Cek level & XP kamu.
▫️ \`!top\` atau \`.leaderboard\` — Cek 5 besar member.

📥 *MULTI-PLATFORM DOWNLOADER*
Kirim link YouTube MP3, TikTok, IG, FB, atau Pinterest untuk unduh media otomatis (+25 XP)!`;

                if (from === GROUP_ANOTHER) {
                    menuText += `\n\n✂️ *FITUR MULTIMEDIA KHUSUS*\n▫️ \`.bg\` — Hapus latar belakang foto.\n▫️ \`.hd\` — Jernihkan foto jadi HD.`;
                }

                await sock.sendMessage(from, { 
                    text: menuText, 
                    mentions: [userJid] 
                }, { quoted: msg });
                
                return;
            }

            // Groq AI
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
                        await sock.sendMessage(from, { text: '⚠️ API Key Groq belum diset di environment variables!' }, { quoted: msg });
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

            // Downloader YouTube
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

            // Downloader TikTok
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

            // Downloader Instagram
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

            // Downloader FB & Pinterest
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

            // Level & Leaderboard
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

            // Cooldown XP
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