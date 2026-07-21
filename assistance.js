const chatBody = document.getElementById("chatBody");
        const chatInput = document.getElementById("chatInput");

        function handleKeyPress(e) { if (e.key === "Enter") sendMessage(); }

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text) return;

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const userHtml = `
                <div class="msg-bubble msg-user">
                    <div class="msg-meta">
                        <span>${timeStr}</span>
                        <span>Officer</span>
                    </div>
                    ${escapeHtml(text)}
                </div>
            `;
            chatBody.insertAdjacentHTML("beforeend", userHtml);
            chatInput.value = "";
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        function escapeHtml(text) {
            return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }