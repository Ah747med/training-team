/**
 * ISON AI Chatbot Module
 * Handles interaction with OpenRouter AI and provides context-aware support.
 */

const chatbot = {
    // API Configuration
    API_KEY: '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',
    MODELS: [
        'openrouter/free',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'google/gemma-4-26b-a4b-it:free',
        'liquid/lfm-3-1.7b:free'
    ],
    
    // State
    history: [],
    isVisible: false,

    init() {
        this.history = [
            { 
                role: 'system', 
                content: `You are a smart assistant for the ISON Training Management System.
                - You are a highly professional smart assistant and an expert on every project (account) within the ISON Training System.
                - Help managers with trainer data, batches, and project-specific statistics.
                - You have full access to knowing which trainers are assigned to which accounts (like Watch IT, B-Tech, etc.).
                - If asked about a specific batch result for a trainer, provide the text summary (Pass, Fail, Total).
                - IMPORTANT: When providing batch results, also append this EXACT tag at the end of your message: [CHART:{"pass":PASS_COUNT, "fail":FAIL_COUNT, "total":TOTAL_COUNT, "batch":"BATCH_NAME"}]
                - Answer in the user's language. Be concise, professional, and helpful.
`
            }
        ];
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    toggle() {
        const win = document.getElementById('chatbot-window');
        if (win) {
            win.classList.toggle('hidden');
            this.isVisible = !win.classList.contains('hidden');
            if (this.isVisible) {
                const input = document.getElementById('chatbot-input');
                if (input) input.focus();
            }
        }
    },

    clear() {
        const modal = document.getElementById('chatbot-modal');
        if (modal) modal.classList.add('active');
    },

    closeModal() {
        const modal = document.getElementById('chatbot-modal');
        if (modal) modal.classList.remove('active');
    },

    confirmClear() {
        this.closeModal();
        this.init(); // Reset history
        const container = document.getElementById('chatbot-messages');
        if (container) {
            container.innerHTML = `
                <div class="message bot">
                    <div class="msg-bubble">
                        Welcome! I am your smart assistant. How can I help you today regarding the training data?
                    </div>
                </div>
            `;
        }
    },

    show() {
        const container = document.getElementById('ai-chatbot-container');
        if (container) container.classList.remove('hidden');
    },

    hide() {
        const container = document.getElementById('ai-chatbot-container');
        if (container) {
            container.classList.add('hidden');
            const win = document.getElementById('chatbot-window');
            if (win) win.classList.add('hidden');
            this.isVisible = false;
        }
    },

    getContext() {
        const appGlobal = window.app || (typeof app !== 'undefined' ? app : null);
        if (!appGlobal || !appGlobal.accounts || !appGlobal.trainers) {
            return "System data is currently unavailable.";
        }

        const validTrainers = (appGlobal.trainers || []).filter(t => t && typeof t === 'object' && t.name);
        const validAccounts = (appGlobal.accounts || []).filter(a => a && typeof a === 'object' && a.name);
        const validLeaders = (appGlobal.leaders || []).filter(l => l && typeof l === 'object' && l.name);

        const totalAccounts = validAccounts.length;
        const totalTrainers = validTrainers.length;
        const totalLeaders = validLeaders.length;
        
        const allPitches = validTrainers.flatMap(t => t.pitchResults || []);
        const totalBatches = allPitches.length;
        const totalTrainees = allPitches.reduce((sum, p) => sum + (parseInt(p.total) || ((parseInt(p.pass) || 0) + (parseInt(p.fail) || 0))), 0);
        const totalPass = allPitches.reduce((sum, p) => sum + (parseInt(p.pass) || 0), 0);
        
        // 1. Group trainers by Team / Leader (Crucial for queries like "team noor", "team raghda")
        const leadersSummary = validLeaders.map(leader => {
            const teamTrainers = validTrainers.filter(t => {
                if (typeof appGlobal.isTrainerUnderLeader === 'function') {
                    return appGlobal.isTrainerUnderLeader(t, leader);
                }
                const lId = String(leader.id);
                const lUser = (leader.user || '').toLowerCase().trim();
                const lName = (leader.name || '').toLowerCase().trim();
                const tLead = String(t.leaderId || '').toLowerCase().trim();
                return tLead === lId || tLead === lUser || tLead === lName;
            });
            const names = teamTrainers.map(t => t.name).join(', ');
            return `- Team / Leader: "${leader.name}" (Username / Alias: "${leader.user || 'N/A'}", ID: ${leader.id}). Total trainers: ${teamTrainers.length}. Assigned trainers: [${names || 'None'}]`;
        }).join('\n');

        // 2. Group trainers by Account for clear project mapping
        const projectsSummary = validAccounts.map(acc => {
            const assignedTrainers = validTrainers.filter(t => 
                String(t.accountId) === String(acc.id) || (t.secondaryAccountIds && t.secondaryAccountIds.map(String).includes(String(acc.id)))
            );
            const names = assignedTrainers.map(t => t.name).join(', ');
            return `- Account/Project: "${acc.name}". Assigned trainers: [${names || 'None'}]`;
        }).join('\n');

        // 3. Detailed Trainer Records
        const trainersDetails = validTrainers.map(t => {
            const primaryAcc = validAccounts.find(a => String(a.id) === String(t.accountId))?.name || 'N/A';
            const secondaryAccs = (t.secondaryAccountIds || []).map(id => validAccounts.find(a => String(a.id) === String(id))?.name).filter(Boolean).join(', ');
            const leaderObj = validLeaders.find(l => {
                if (typeof appGlobal.isTrainerUnderLeader === 'function') return appGlobal.isTrainerUnderLeader(t, l);
                return String(t.leaderId) === String(l.id);
            });
            const leadName = leaderObj ? `${leaderObj.name} (${leaderObj.user || ''})` : 'Unassigned';
            const pitches = t.pitchResults || [];
            const pitchHistory = pitches.map(p => `Batch ${p.batch}: (Total:${p.total || ((parseInt(p.pass)||0)+(parseInt(p.fail)||0))}, Pass:${p.pass}, Fail:${p.fail})`).join(' | ');
            return `- Trainer: ${t.name}. Team/Leader: ${leadName}. Main Account: ${primaryAcc}. Secondary: ${secondaryAccs || 'None'}. Batches: ${pitchHistory || 'None'}`;
        }).join('\n');

        return `
Current System Data Context (ISON Training System):
- Total Accounts: ${totalAccounts} | Total Trainers: ${totalTrainers} | Total Leaders: ${totalLeaders}
- Total Batches: ${totalBatches} | Total Trainees: ${totalTrainees} | Total Pass: ${totalPass}

1. Teams & Team Leaders (Trainers in each Team):
${leadersSummary}

2. Accounts & Assigned Trainers:
${projectsSummary}

3. Detailed Trainer Records & Batches:
${trainersDetails}
        `;
    },

    findLocalAnswer(query) {
        const appGlobal = window.app || (typeof app !== 'undefined' ? app : null);
        if (!appGlobal || !appGlobal.trainers) return null;

        const validTrainers = (appGlobal.trainers || []).filter(t => t && typeof t === 'object' && t.name);
        const validAccounts = (appGlobal.accounts || []).filter(a => a && typeof a === 'object' && a.name);
        const validLeaders = (appGlobal.leaders || []).filter(l => l && typeof l === 'object' && l.name);
        const isArabic = /[\u0600-\u06FF]/.test(query);
        const q = query.toLowerCase().trim();

        // 1. Team / Leader Inquiry: e.g. "how many trainers in the team noor", "team noor", "كم عدد المدربين في فريق نور", "فريق نور"
        for (const leader of validLeaders) {
            const lUser = (leader.user || '').toLowerCase().trim();
            const lName = (leader.name || '').toLowerCase().trim();
            const lNameParts = lName.split(' ').map(p => p.trim()).filter(p => p.length >= 3);

            let isMatch = false;
            if (lUser && q.includes(lUser)) isMatch = true;
            if (lName && q.includes(lName)) isMatch = true;
            if (lNameParts.some(part => q.includes(part))) isMatch = true;

            // Arabic normalization for Noor / Nada / Raghda
            if (lUser === 'noor' && (q.includes('noor') || q.includes('nour') || q.includes('نور'))) isMatch = true;
            if (lUser === 'nada' && (q.includes('nada') || q.includes('ندى') || q.includes('ندا'))) isMatch = true;
            if (lUser.toLowerCase() === 'raghda' && (q.includes('raghda') || q.includes('رغدة') || q.includes('رغده'))) isMatch = true;

            if (isMatch && (q.includes('team') || q.includes('فريق') || q.includes('trainer') || q.includes('مدرب') || q.includes('how many') || q.includes('who') || q.includes('مين') || q.includes('count') || q.includes('عدد'))) {
                const teamTrainers = validTrainers.filter(t => {
                    if (typeof appGlobal.isTrainerUnderLeader === 'function') {
                        return appGlobal.isTrainerUnderLeader(t, leader);
                    }
                    const lId = String(leader.id);
                    const tLead = String(t.leaderId || '').toLowerCase().trim();
                    return tLead === lId || tLead === lUser || tLead === lName;
                });

                const count = teamTrainers.length;
                const trainerList = teamTrainers.map((t, idx) => `${idx + 1}. **${t.name}**`).join('\n');

                if (isArabic) {
                    return `يوجد **${count} مدرباً** في **فريق ${leader.name}** (Team ${leader.user || leader.name}):\n\n${trainerList || 'لا يوجد مدربون مسجلون في هذا الفريق حالياً.'}`;
                } else {
                    return `There are **${count} trainers** in **Team ${leader.name}** (Team ${leader.user || leader.name}):\n\n${trainerList || 'No trainers are currently assigned to this team.'}`;
                }
            }
        }

        // 2. Direct Batch Search: e.g. "who is the trainer batch 200", "batch 200", "باتش 200"
        const batchMatch = q.match(/(?:batch|باتش)\s*#?([a-zA-Z0-9_\-]+)/i) || q.match(/(?:^|\s)#?([0-9]{2,4})(?:\s|$)/);
        if (batchMatch) {
            const targetBatch = batchMatch[1].trim().toLowerCase();
            for (const t of validTrainers) {
                if (!t.pitchResults || !Array.isArray(t.pitchResults)) continue;
                const foundPitch = t.pitchResults.find(p => p && String(p.batch).trim().toLowerCase() === targetBatch);
                if (foundPitch) {
                    const acc = validAccounts.find(a => String(a.id) === String(t.accountId))?.name || '';
                    const pass = parseInt(foundPitch.pass) || 0;
                    const fail = parseInt(foundPitch.fail) || 0;
                    const total = parseInt(foundPitch.total) || (pass + fail);
                    const rate = total > 0 ? ((pass / total) * 100).toFixed(1) : '0.0';

                    if (isArabic) {
                        return `المدرب المسؤول عن **باتش ${foundPitch.batch}** هو **${t.name}**${acc ? ` (مشروع ${acc})` : ''}.\n\n📊 **نتائج الباتش:**\n- إجمالي المتدربين: ${total}\n- عدد الناجحين: ${pass}\n- عدد الراسبين: ${fail}\n- نسبة النجاح: ${rate}%\n[CHART:{"pass":${pass}, "fail":${fail}, "total":${total}, "batch":"${foundPitch.batch}"}]`;
                    } else {
                        return `The trainer for **Batch ${foundPitch.batch}** is **${t.name}**${acc ? ` (${acc})` : ''}.\n\n📊 **Batch Stats:**\n- Total Trainees: ${total}\n- Passed: ${pass}\n- Failed: ${fail}\n- Pass Rate: ${rate}%\n[CHART:{"pass":${pass}, "fail":${fail}, "total":${total}, "batch":"${foundPitch.batch}"}]`;
                    }
                }
            }
        }

        // 3. Direct Trainer Name Search: e.g. "who is sohila", "sohila abdallah", "مين سهيلة"
        for (const t of validTrainers) {
            const tNameLower = t.name.toLowerCase();
            if (q.includes(tNameLower) || tNameLower.split(' ').some(part => part.length >= 4 && q.includes(part))) {
                const acc = validAccounts.find(a => String(a.id) === String(t.accountId))?.name || 'N/A';
                const pitches = (t.pitchResults || []).map(p => `Batch ${p.batch} (Pass: ${p.pass}, Fail: ${p.fail})`).join(', ');
                if (isArabic) {
                    return `**المدرب: ${t.name}**\n- المشروع الأساسي: ${acc}\n- الحالة: ${t.status || 'Active'}\n- السجل التدريبي: ${pitches || 'لا يوجد باتشات مسجلة حالياً'}`;
                } else {
                    return `**Trainer: ${t.name}**\n- Main Project: ${acc}\n- Status: ${t.status || 'Active'}\n- Batches: ${pitches || 'No batches recorded yet'}`;
                }
            }
        }

        return null;
    },

    async handleSend() {
        const input = document.getElementById('chatbot-input');
        const text = input.value.trim();
        if (!text) return;

        const isArabic = /[\u0600-\u06FF]/.test(text);
        this.addMessage('user', text);
        input.value = '';

        const typing = document.getElementById('chatbot-typing');
        if (typing) typing.classList.remove('hidden');

        try {
            // First check local system database resolver for immediate accurate answer
            const localAns = this.findLocalAnswer(text);
            let response = null;

            try {
                response = await this.sendMessageToAI(text);
            } catch (apiErr) {
                console.warn("AI API request failed, checking local database fallback:", apiErr);
                if (localAns) {
                    response = localAns;
                } else {
                    throw apiErr;
                }
            }

            if (typing) typing.classList.add('hidden');
            this.addMessage('bot', response);
        } catch (err) {
            if (typing) typing.classList.add('hidden');
            // Check local answer again as last resort
            const localFallback = this.findLocalAnswer(text);
            if (localFallback) {
                this.addMessage('bot', localFallback);
                return;
            }

            const errorMsg = isArabic
                ? 'عذراً، حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.'
                : 'Sorry, could not connect to the AI service. Please try again in a few moments.';
            this.addMessage('bot', errorMsg);
            console.error("Chatbot Error:", err);
        }
    },

    addMessage(role, text) {
        const container = document.getElementById('chatbot-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        // Detect and parse Chart Tag
        let cleanText = text;
        let chartData = null;
        const chartMatch = text.match(/\[CHART:(\{.*?\})\]/);
        
        if (chartMatch) {
            try {
                chartData = JSON.parse(chartMatch[1]);
                cleanText = text.replace(chartMatch[0], '').trim();
            } catch (e) {
                console.error("Chart data parsing error:", e);
            }
        }

        msgDiv.innerHTML = `<div class="msg-bubble">${cleanText}</div>`;
        container.appendChild(msgDiv);

        if (chartData && typeof Chart !== 'undefined') {
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'chat-chart-wrapper';
            canvasWrapper.style.marginTop = '10px';
            canvasWrapper.style.width = '100%';
            canvasWrapper.style.height = '180px';
            
            const canvas = document.createElement('canvas');
            canvasWrapper.appendChild(canvas);
            msgDiv.querySelector('.msg-bubble').appendChild(canvasWrapper);
            
            this.renderChart(canvas, chartData);
        }
        
        container.scrollTop = container.scrollHeight;
        this.history.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
    },

    renderChart(canvas, data) {
        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    label: `Results (Total: ${data.total})`,
                    data: [data.pass, data.fail],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: true, text: `Batch ${data.batch} Results`, font: { size: 12 } } },
                scales: { 
                    y: { beginAtZero: true, grid: { display: false }, ticks: { precision: 0 } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    async sendMessageToAI(userMessage) {
        const context = this.getContext();
        const baseSystemPrompt = this.history[0]?.content || "You are a smart assistant for the ISON Training Management System. Answer in the same language as the user's question.";
        const fullSystemMessage = `${baseSystemPrompt}\n\n${context}`;

        const messages = [
            { role: 'system', content: fullSystemMessage },
            ...this.history.slice(1).slice(-6)
        ];

        let lastError = null;

        for (const model of this.MODELS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 18000);

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'HTTP-Referer': 'https://ison-training.com',
                        'X-Title': 'ISON Training System'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errBody = await response.text().catch(() => '');
                    console.warn(`OpenRouter model ${model} returned HTTP ${response.status}:`, errBody);
                    lastError = new Error(`API Error ${response.status}`);
                    continue; // Try next fallback model
                }

                const data = await response.json();
                if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                    const content = data.choices[0].message.content;
                    if (content && content.trim()) {
                        return content.trim();
                    }
                }
            } catch (netErr) {
                console.warn(`Error contacting OpenRouter model ${model}:`, netErr);
                lastError = netErr;
            }
        }

        throw lastError || new Error("Failed to receive response from AI models");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    chatbot.init();
});
