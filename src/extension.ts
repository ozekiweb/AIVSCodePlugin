import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWebviewContent } from './chatBox';
import { ChatLogger } from './chatLogger';
import { getRatingWebviewContent } from './ratingWindow';
import { AutoCompleteProvider } from './autoComplete';
import { PromptGenerator } from './generatePrompt';

interface Settings {
	apiUrl: string;
	apiKey: string;
	modelName: string;
	credentials?: string;
	authType: 'apiKey' | 'credentials';
}
let settings: Settings | null = null;

export async function activate(context: vscode.ExtensionContext) {
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
		const defaultSettings = '';
		fs.writeFileSync(settingsPath, defaultSettings);
		console.log('Created new settings.json file');
		console.log('Settings path:', settingsPath);
	}

	// Load settings from settings.json file
	try {
		const fileContent = fs.readFileSync(settingsPath, 'utf8');
		settings = JSON.parse(fileContent);
		// Validate
		if (settings && settings.apiUrl && (settings.apiKey || settings.credentials)) {
			console.log('Valid settings loaded from file');
		} else {
			console.log('Invalid or incomplete settings, showing dialog');
			await showSettingsDialog(context);
		}
	} catch (error) {
		console.log('Failed to load settings.');
		await showSettingsDialog(context);
	}

	const createChatPanel = async () => {
		// Only show settings dialog if settings are missing or invalid
		if (!settings || !settings.apiUrl || (!settings.apiKey && !settings.credentials)) {
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
		const logger = new ChatLogger(context.globalStorageUri.fsPath);

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.type) {
					case 'message':
						try {
							// Log user message
							logger.logMessage(message.text, true);

							const response = await sendApiRequest(message.text);

							// Log assistant response
							logger.logMessage(response, false);

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

		panel.onDidDispose(() => {
			showRatingWindow(context, logger);
		});
	};

	let disposable = vscode.commands.registerCommand('ozeki-ai.startChat', createChatPanel);
	let settingsCommand = vscode.commands.registerCommand('ozeki-ai.settings', showSettingsDialog);

	// Register the autocomplete provider
	const provider = new AutoCompleteProvider(settings);
	context.subscriptions.push(provider);

	const promptGenerator = new PromptGenerator(settings);
	context.subscriptions.push(promptGenerator);

	context.subscriptions.push(disposable, settingsCommand);
}

// Show settings dialog to configure API URL, API Key/credentials, model name and save them to settings.json
async function showSettingsDialog(context: vscode.ExtensionContext) {
	const authMethod = await vscode.window.showQuickPick(
		[
			{ label: 'API Key', description: 'Authenticate using an API key' },
			{ label: 'Username/Password', description: 'Authenticate using username and password' }
		],
		{
			placeHolder: 'Select authentication method',
			ignoreFocusOut: true
		}
	);

	if (!authMethod) {
		return;
	}

	let apiUrl = '';
	while (!apiUrl) {
		apiUrl = await vscode.window.showInputBox({
			prompt: 'Enter API URL',
			placeHolder: 'https://api.example.com/chat?action=chatgpt',
			value: settings?.apiUrl || '',
			ignoreFocusOut: true
		}) || '';

		if (!apiUrl) {
			const retry = await vscode.window.showErrorMessage('API URL is required', 'Try Again', 'Cancel');
			if (retry !== 'Try Again') {
				return;
			}
		}
	}

	let apiKey = '', credentials = '';

	if (authMethod.label === 'API Key') {
		while (!apiKey) {
			apiKey = await vscode.window.showInputBox({
				prompt: 'Enter API Key',
				placeHolder: 'your-api-key',
				value: settings?.apiKey || '',
				ignoreFocusOut: true
			}) || '';

			if (!apiKey) {
				const retry = await vscode.window.showErrorMessage('API Key is required', 'Try Again', 'Cancel');
				if (retry !== 'Try Again') {
					return;
				}
			}
		}
	} else {
		let username = '', password = '';
		while (!username || !password) {
			if (!username) {
				username = await vscode.window.showInputBox({
					prompt: 'Enter Username',
					placeHolder: 'your-username',
					ignoreFocusOut: true
				}) || '';

				if (!username) {
					const retry = await vscode.window.showErrorMessage('Username is required', 'Try Again', 'Cancel');
					if (retry !== 'Try Again') {
						return;
					}
					continue;
				}
			}

			if (!password) {
				password = await vscode.window.showInputBox({
					prompt: 'Enter Password',
					placeHolder: 'your-password',
					password: true,
					ignoreFocusOut: true
				}) || '';

				if (!password) {
					const retry = await vscode.window.showErrorMessage('Password is required', 'Try Again', 'Cancel');
					if (retry !== 'Try Again') {
						return;
					}
				}
			}
		}
		credentials = Buffer.from(`${username}:${password}`).toString('base64');
	}
	const modelName = await vscode.window.showInputBox({
		prompt: 'Enter Model Name (default: Nemotron-70B)',
		placeHolder: 'Nemotron-70B',
		value: settings?.modelName || '',
		ignoreFocusOut: true
	});
	settings = {
		apiUrl: apiUrl,
		apiKey: authMethod.label === 'API Key' ? apiKey : '',
		modelName: modelName || 'Nemotron-70B',
		credentials: authMethod.label === 'Username/Password' ? credentials : '',
		authType: authMethod.label === 'API Key' ? 'apiKey' : 'credentials'
	};
	const settingsPath = path.join(context.globalStorageUri.fsPath, 'settings.json');
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
	vscode.window.showInformationMessage('Settings saved successfully!');
}

// Send a message to the API and return formatted the response
async function sendApiRequest(message: string): Promise<string> {
	if (!settings) {
		throw new Error('Settings not configured');
	}
	try {
		const requestBody = {
			"model": settings.modelName || "Nemotron-70B",
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
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': settings.authType === 'apiKey'
				? `Bearer ${settings.apiKey}`
				: `Basic ${settings.credentials}`
		};
		const response = await fetch(settings.apiUrl, {
			method: 'POST',
			headers,
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

// Add this function to show the rating window
function showRatingWindow(context: vscode.ExtensionContext, logger: ChatLogger) {
	const panel = vscode.window.createWebviewPanel(
		'ozekiAIRating',
		'Rate Your Chat Experience',
		vscode.ViewColumn.Two,
		{
			enableScripts: true,
			retainContextWhenHidden: false
		}
	);

	panel.webview.html = getRatingWebviewContent();

	panel.webview.onDidReceiveMessage(
		async message => {
			if (message.type === 'submit-rating') {
				logger.logRating(message.rating, message.feedback);
				vscode.window.showInformationMessage('Thank you for your feedback!');
				panel.dispose();
			}
		},
		undefined,
		context.subscriptions
	);
}

export function deactivate() {

	console.log('Now inactive!');
}
