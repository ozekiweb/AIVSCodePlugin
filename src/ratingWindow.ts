import * as vscode from 'vscode';

export function getRatingWebviewContent() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rate Your Chat Experience</title>
            <style>
                body {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .rating-container {
                    margin: 20px 0;
                    display: flex;
                    gap: 10px;
                }
                .star {
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--vscode-descriptionForeground);
                    transition: color 0.2s;
                }
                .star.active {
                    color: #FFD700;
                }
                .feedback-container {
                    width: 100%;
                    max-width: 400px;
                    margin-top: 20px;
                }
                textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 10px;
                    margin: 10px 0;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    resize: vertical;
                    font-family: inherit;
                }
                button {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h2>How was your chat experience?</h2>
            <div class="rating-container">
                <span class="star" data-rating="1">★</span>
                <span class="star" data-rating="2">★</span>
                <span class="star" data-rating="3">★</span>
                <span class="star" data-rating="4">★</span>
                <span class="star" data-rating="5">★</span>
            </div>
            <div class="feedback-container">
                <p>Would you like to share any feedback?</p>
                <textarea id="feedback" placeholder="Your feedback (optional)"></textarea>
                <button id="submit">Submit Rating</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const stars = document.querySelectorAll('.star');
                let currentRating = 0;

                stars.forEach(star => {
                    star.addEventListener('mouseover', function() {
                        const rating = this.dataset.rating;
                        highlightStars(rating);
                    });

                    star.addEventListener('mouseout', function() {
                        highlightStars(currentRating);
                    });

                    star.addEventListener('click', function() {
                        currentRating = this.dataset.rating;
                        highlightStars(currentRating);
                    });
                });

                function highlightStars(rating) {
                    stars.forEach(star => {
                        star.classList.toggle('active', star.dataset.rating <= rating);
                    });
                }

                document.getElementById('submit').addEventListener('click', () => {
                    const feedback = document.getElementById('feedback').value;
                    vscode.postMessage({
                        type: 'submit-rating',
                        rating: currentRating,
                        feedback: feedback
                    });
                });
            </script>
        </body>
        </html>
    `;
}
