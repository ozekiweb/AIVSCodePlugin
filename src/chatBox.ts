export function getWebviewContent() {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Ozeki AI Chat</title>
			<style>
				body {
					padding: 20px;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
					margin: 0;
					background-color: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					height: 100vh;
					display: flex;
					flex-direction: column;
				}
				#chat-container {
					flex: 1;
					overflow-y: auto;
					padding: 20px;
					margin-bottom: 20px;
					border: 1px solid var(--vscode-widget-border);
					border-radius: 8px;
					background-color: var(--vscode-editor-background);
				}
				#input-container {
					display: flex;
					gap: 10px;
					padding: 15px;
					background-color: var(--vscode-editor-background);
					border: 1px solid var(--vscode-widget-border);
					border-radius: 8px;
				}
				#message-input {
					flex: 1;
					padding: 10px;
					border: none;
					border-radius: 4px;
					background-color: var(--vscode-input-background);
					color: var(--vscode-input-foreground);
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
					font-size: 14px;
					outline: none;
					min-height: 40px;
					resize: none;
				}
				#send-button {
					padding: 10px 20px;
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-weight: 500;
					transition: background-color 0.2s;
					min-width: 80px;
				}
				#send-button:hover {
					background-color: var(--vscode-button-hoverBackground);
				}
				#send-button:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
				.message {
					margin-bottom: 16px;
					padding: 12px 16px;
					border-radius: 8px;
					max-width: 85%;
					word-wrap: break-word;
					line-height: 1.4;
					position: relative;
					animation: fadeIn 0.3s ease-out;
				}
				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(10px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.user-message {
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					margin-left: auto;
					border-bottom-right-radius: 4px;
				}
				.assistant-message {
					background-color: var(--vscode-editor-inactiveSelectionBackground);
					color: var(--vscode-editor-foreground);
					margin-right: auto;
					border-bottom-left-radius: 4px;
				}
				.message-time {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
					margin-top: 4px;
					text-align: right;
				}
				pre {
					background-color: var(--vscode-textBlockQuote-background);
					padding: 10px;
					border-radius: 4px;
					overflow-x: auto;
					margin: 8px 0;
				}
				code {
					font-family: 'Consolas', 'Courier New', monospace;
				}
			</style>
		</head>
		<body>
			<div id="chat-container">
				<div class="message assistant-message">
					Hello! I'm your AI assistant. How can I help you today?
				</div>
			</div>
			<div id="input-container">
				<textarea 
					id="message-input" 
					placeholder="Type your message..." 
					rows="1"
					autofocus
				></textarea>
				<button id="send-button">Send</button>
			</div>
			<script>
				const vscode = acquireVsCodeApi();
				const chatContainer = document.getElementById('chat-container');
				const messageInput = document.getElementById('message-input');
				const sendButton = document.getElementById('send-button');

				// Auto-resize textarea
				messageInput.addEventListener('input', function() {
					this.style.height = 'auto';
					this.style.height = (this.scrollHeight) + 'px';
					this.style.height = Math.min(this.scrollHeight, 200) + 'px';
				});

				function addMessage(content, isUser = false) {
					const messageDiv = document.createElement('div');
					messageDiv.className = 'message ' + (isUser ? 'user-message' : 'assistant-message');
					messageDiv.textContent = content;
					chatContainer.appendChild(messageDiv);
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}

				function handleSend() {
					const message = messageInput.value.trim();
					if (message) {
						addMessage(message, true);
						messageInput.value = '';
						messageInput.style.height = 'auto';
						vscode.postMessage({ type: 'message', text: message });
						messageInput.disabled = true;
						sendButton.disabled = true;
					}
				}

				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'response':
							addMessage(message.text, false);
							messageInput.disabled = false;
							sendButton.disabled = false;
							messageInput.focus();
							break;
					}
				});

				messageInput.addEventListener('keypress', (e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						handleSend();
					}
				});

				sendButton.addEventListener('click', handleSend);
			</script>
		</body>
		</html>
	`;
}