import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface Settings {
	apiUrl: string;
	apiKey: string;
}

let settings: Settings | null = null;

export function activate(context: vscode.ExtensionContext) {
	console.log('Ozeki Ai is now active!');

	// Check if the global storage folder exists, if not create it
	const globalStoragePath = context.globalStorageUri.fsPath;
	if (!fs.existsSync(globalStoragePath)) {
		console.log('No global storage folder found, creating a new one.');
		fs.mkdirSync(globalStoragePath, { recursive: true });
		console.log('Created new global storage folder');
	}

	// Check if settings file exists, if not create it
	const settingsPath = path.join(globalStoragePath, 'settings.json');
	if (!fs.existsSync(settingsPath)) {
		console.log('No settings.json file found, creating a new one.');
		const defaultSettings = { apiUrl: '', apiKey: '' };
		fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
		console.log('Created new settings.json file');
		console.log('Settings path:', settingsPath);
	}

	// Load settings from settings.json file, or get input from user
	try {
		const fileContent = fs.readFileSync(settingsPath, 'utf8');
		settings = JSON.parse(fileContent);
		console.log('Settings loaded from file:', settings);
	} catch (error) {
		console.error('Failed to load settings:', error);
	}

	const createChatPanel = async () => {
		if (!settings || !settings.apiUrl || !settings.apiKey) {
			await showSettingsDialog(context);
		}

		const panel = vscode.window.createWebviewPanel(
			'ozekiAIChat',
			'Ozeki AI Chat',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);
		panel.webview.html = getWebviewContent();

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.type) {
					case 'message':
						try {
							const response = await sendApiRequest(message.text);
							panel.webview.postMessage({
								type: 'response',
								text: response
							});
						} catch (error) {
							vscode.window.showErrorMessage('Failed to send message: ' + error);
						}
						break;
				}
			},
			undefined,
			context.subscriptions
		);
	};

	let disposable = vscode.commands.registerCommand('ozeki-ai.startChat', createChatPanel);
	let settingsCommand = vscode.commands.registerCommand('ozeki-ai.settings', showSettingsDialog);
	context.subscriptions.push(disposable, settingsCommand);
	createChatPanel();
}

// Show settings dialog to configure API URL and API Key, and save them to settings.json
async function showSettingsDialog(context: vscode.ExtensionContext) {
	const apiUrl = await vscode.window.showInputBox({
		prompt: 'Enter API URL',
		placeHolder: 'https://api.example.com/chat?',
		value: settings?.apiUrl || ''
	});

	if (!apiUrl) {
		throw new Error('API URL is required');
	}

	const apiKey = await vscode.window.showInputBox({
		prompt: 'Enter API Key',
		placeHolder: 'your-api-key',
		value: settings?.apiKey || ''
	});

	if (!apiKey) {
		throw new Error('API Key is required');
	}
	const updatedApiUrl = `${apiUrl}command=chatgpt`;
	settings = { apiUrl: updatedApiUrl, apiKey };
	const settingsPath = path.join(context.globalStorageUri.fsPath, 'settings.json');
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
	console.log('Settings saved to:', settingsPath);
	vscode.window.showInformationMessage('Settings saved successfully!');
}

// Send a message to the API and return the response, formatted the response
async function sendApiRequest(message: string): Promise<string> {
	if (!settings) {
		throw new Error('Settings not configured');
	}

	try {
		const requestBody = {
			"model": "Nemotron-70B",
			"messages": [
				{
					"role": "system",
					"content": "Transcript of a conversation between the User and an Assistant. Assistant is a friendly, reliable, and highly knowledgeable assistant, known for being helpful, empathetic, and honest. Assistant consistently delivers prompt, clear, and accurate responses, excelling in writing and problem-solving, ensuring the User's requests are addressed with precision and care! Always sends clear messages with no bold or italic text."
				},
				{
					"role": "user",
					"content": message
				}
			],
			"temperature": 0.7,
			"max_completion_tokens": 100
		};

		console.log('Sending request to:', settings.apiUrl);
		console.log('Request body:', JSON.stringify(requestBody, null, 2));

		const response = await fetch(settings.apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${settings.apiKey}`
			},
			body: JSON.stringify(requestBody)
		});

		const responseBody = await response.text();
		console.log('Response status:', response.status);
		console.log('Response body:', responseBody);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}\nBody: ${responseBody}`);
		}

		try {
			const data = JSON.parse(responseBody);
			let formattedResponse = '';

			if (data.choices && data.choices[0]?.message?.content) {
				formattedResponse = data.choices[0].message.content;
			} else if (data.response) {
				// Try to parse the response as JSON if it's a string
				try {
					const parsedResponse = JSON.parse(data.response);
					formattedResponse = parsedResponse.message || parsedResponse.content || data.response;
				} catch {
					formattedResponse = data.response;
				}
			} else if (typeof data === 'string') {
				formattedResponse = data;
			} else {
				console.log('Unexpected response format:', data);
				formattedResponse = JSON.stringify(data, null, 2);
			}

			// Format the response, so it looks better in the chat
			formattedResponse = formattedResponse
				.replace(/\*\*/g, '')
				.replace(/\\n/g, '\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim();

			return formattedResponse;
		} catch (parseError) {
			console.error('Failed to parse response:', parseError);
			return responseBody.replace(/\*\*/g, '').replace(/\\n/g, '\n').trim();
		}
	} catch (error) {
		console.error('API request failed:', error);
		throw error;
	}
}
// Create the webview content, including the chat UI and message handling logic
function getWebviewContent() {
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
				}
				#chat-container {
					height: calc(100vh - 140px);
					overflow-y: auto;
					border: 1px solid var(--vscode-widget-border);
					border-radius: 8px;
					padding: 16px;
					margin-bottom: 16px;
					background-color: var(--vscode-editor-background);
				}
				#input-container {
					display: flex;
					gap: 12px;
					padding: 8px;
					background-color: var(--vscode-editor-background);
					border: 1px solid var(--vscode-widget-border);
					border-radius: 8px;
				}
				#message-input {
					flex-grow: 1;
					padding: 12px;
					border: none;
					border-radius: 4px;
					background-color: var(--vscode-input-background);
					color: var(--vscode-input-foreground);
					font-size: 14px;
					outline: none;
				}
				#message-input:focus {
					outline: 1px solid var(--vscode-focusBorder);
				}
				#send-button {
					padding: 8px 20px;
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-weight: 500;
					transition: background-color 0.2s;
				}
				#send-button:hover {
					background-color: var(--vscode-button-hoverBackground);
				}
				.message {
					margin-bottom: 16px;
					padding: 12px;
					border-radius: 8px;
					max-width: 80%;
					word-wrap: break-word;
				}
				.user-message {
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					margin-left: auto;
				}
				.assistant-message {
					background-color: var(--vscode-editor-inactiveSelectionBackground);
					color: var(--vscode-editor-foreground);
					margin-right: auto;
				}
				.message-time {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
					margin-top: 4px;
					text-align: right;
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
				<input type="text" 
					id="message-input" 
					placeholder="Type your message..." 
					autofocus
				>
				<button id="send-button">Send</button>
			</div>
			<script>
				const vscode = acquireVsCodeApi();
				const chatContainer = document.getElementById('chat-container');
				const messageInput = document.getElementById('message-input');
				const sendButton = document.getElementById('send-button');

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
						vscode.postMessage({ type: 'message', text: message });
						// Disable input while waiting for response
						messageInput.disabled = true;
						sendButton.disabled = true;
					}
				}

				// Handle responses from the extension
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'response':
							addMessage(message.text, false);
							// Re-enable input after receiving response
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
export function deactivate() {
	console.log('Now inactive!');
}
