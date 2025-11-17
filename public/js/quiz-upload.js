// Quiz Upload Handler for Controller Page
// Handles XLSX file uploads with password protection

class QuizUploader {
    constructor() {
        this.isAuthenticated = false;
        this.modal = document.getElementById('upload-modal');
        this.form = document.getElementById('upload-quiz-form');
        this.fileInput = document.getElementById('upload-file-input');
        this.fileLabel = document.getElementById('upload-file-label');
        this.statusDiv = document.getElementById('upload-status');
        this.uploadBtn = document.getElementById('upload-quiz-btn');
        this.closeBtn = document.getElementById('close-upload-modal');
        this.cancelBtn = document.getElementById('cancel-upload-btn');
        this.submitBtn = document.getElementById('upload-submit-btn');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Open modal on upload button click
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => this.openModal());
        }

        // Close modal
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Close on outside click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        // File input change
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.fileLabel.textContent = file.name;
                }
            });
        }

        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async openModal() {
        // Check if we're on solo page (no password needed) or controller page (password required)
        const isSoloPage = window.location.pathname.includes('solo.html') || 
                          window.location.pathname === '/' ||
                          !document.getElementById('upload-quiz-btn')?.closest('.controller-only');
        
        // Only require authentication for controller pages
        if (!isSoloPage && !this.isAuthenticated) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return; // User cancelled or wrong password
            }
        }

        // Show modal
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.resetForm();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.resetForm();
        }
    }

    async authenticate() {
        const password = prompt('Enter admin password to upload quiz:');
        
        if (!password) {
            return false; // User cancelled
        }

        try {
            const response = await fetch('/api/verify-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.isAuthenticated = true;
                return true;
            } else {
                alert('Incorrect password. Access denied.');
                return false;
            }
        } catch (error) {
            console.error('Authentication error:', error);
            alert('Authentication error. Please try again.');
            return false;
        }
    }

    resetForm() {
        if (this.form) {
            this.form.reset();
        }
        if (this.fileLabel) {
            this.fileLabel.textContent = 'Choose Excel file or drag & drop';
        }
        if (this.statusDiv) {
            this.statusDiv.innerHTML = '';
            this.statusDiv.className = 'upload-status';
        }
    }

    async handleSubmit(event) {
        event.preventDefault();

        const file = this.fileInput?.files[0];
        if (!file) {
            this.showStatus('Please select a file', 'error');
            return;
        }

        // Validate file type
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            this.showStatus('Please select an Excel file (.xlsx or .xls)', 'error');
            return;
        }

        // Show loading state
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = 'Processing...';
        this.showStatus('Processing Excel file...', 'info');

        try {
            // Read file
            const arrayBuffer = await file.arrayBuffer();
            
            // Parse Excel using SheetJS
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON (array of arrays)
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            // Convert to quiz format
            const quizTitle = document.getElementById('upload-quiz-title')?.value.trim() || 
                            file.name.replace(/\.(xlsx|xls)$/i, '');
            const quizData = this.convertExcelToQuiz(data, quizTitle);

            // Upload to API
            await this.uploadQuiz(quizData, quizTitle, file);

        } catch (error) {
            console.error('Error processing file:', error);
            this.showStatus('Error processing file: ' + error.message, 'error');
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Upload & Convert';
        }
    }

    convertExcelToQuiz(data, title) {
        // Remove header row if it exists
        let startIndex = 0;
        if (data.length > 0) {
            const firstRow = data[0];
            const hasHeaders = firstRow.some(cell =>
                typeof cell === 'string' &&
                /^(question|answer|q|a)/i.test(cell.trim())
            );
            if (hasHeaders) {
                startIndex = 1;
            }
        }

        // Parse questions and answers
        const questions = [];
        for (let i = startIndex; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || (!row[0] && !row[1])) {
                continue;
            }

            const questionText = row[0]?.toString().trim();
            const answerText = row[1]?.toString().trim();

            // Skip if either question or answer is missing
            if (!questionText || !answerText) {
                continue;
            }

            const question = {
                question_number: questions.length + 1,
                question_text: questionText,
                answer: answerText
            };

            questions.push(question);
        }

        if (questions.length === 0) {
            throw new Error('No valid questions found in the Excel file');
        }

        // Create quiz structure
        const quiz = {
            metadata: {
                title: title,
                source: `excel_upload_${new Date().toISOString().split('T')[0]}`,
                date: new Date().toISOString().split('T')[0],
                rounds: 1
            },
            rounds: [
                {
                    round_number: 1,
                    round_name: title,
                    players: [
                        {
                            player_number: 1,
                            questions: questions
                        }
                    ]
                }
            ]
        };

        return quiz;
    }

    async uploadQuiz(quizData, quizTitle, file) {
        try {
            // Create FormData
            const formData = new FormData();
            
            // Convert quiz data to JSON blob
            const quizBlob = new Blob([JSON.stringify(quizData, null, 2)], { type: 'application/json' });
            formData.append('file', file);
            formData.append('quiz', quizBlob, `${quizTitle}.json`);
            formData.append('title', quizTitle);

            this.showStatus('Uploading quiz...', 'info');

            // Upload to API
            const response = await fetch('/api/upload-quiz', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Success!
            this.showStatus(`✅ Quiz uploaded successfully! ${result.saved ? 'Saved to repository.' : 'Download the JSON file.'}`, 'success');
            
            // Refresh quiz list if app exists (works for both multiplayer and solo)
            if (window.app && typeof window.app.loadQuizList === 'function') {
                setTimeout(() => {
                    window.app.loadQuizList();
                }, 1000);
            }
            
            // Also refresh quiz selector dropdown directly
            const quizSelect = document.getElementById('quiz-select');
            if (quizSelect && result.quiz) {
                // Reload quiz list
                fetch('/data/quiz-index.json')
                    .then(r => r.json())
                    .then(index => {
                        quizSelect.innerHTML = '<option value="">Select a quiz...</option>';
                        index.quizzes.forEach((quiz, idx) => {
                            const option = document.createElement('option');
                            option.value = idx;
                            option.textContent = quiz.name;
                            quizSelect.appendChild(option);
                        });
                    })
                    .catch(err => console.error('Error refreshing quiz list:', err));
            }

            // Close modal after 2 seconds
            setTimeout(() => {
                this.closeModal();
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);
            this.showStatus('Upload failed: ' + error.message, 'error');
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Upload & Convert';
        }
    }

    showStatus(message, type = 'info') {
        if (!this.statusDiv) return;

        this.statusDiv.textContent = message;
        this.statusDiv.className = `upload-status ${type}`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize if upload button exists (works for both solo and controller pages)
    if (document.getElementById('upload-quiz-btn')) {
        window.quizUploader = new QuizUploader();
    }
});

