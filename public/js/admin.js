// Admin Upload Handler for Buzzer Quiz
// Handles Excel file uploads and conversion to quiz JSON format

class QuizUploader {
    constructor() {
        this.form = document.getElementById('uploadForm');
        this.fileInput = document.getElementById('fileInput');
        this.fileLabel = document.getElementById('fileLabel');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.resultSection = document.getElementById('resultSection');
        this.errorSection = document.getElementById('errorSection');
        this.quizData = null;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        const fileLabel = document.querySelector('.file-label');
        fileLabel.addEventListener('dragover', (e) => this.handleDragOver(e));
        fileLabel.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        fileLabel.addEventListener('drop', (e) => this.handleDrop(e));

        // Result actions
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadJSON());
        document.getElementById('copyBtn')?.addEventListener('click', () => this.copyToClipboard());
        document.getElementById('uploadAnotherBtn')?.addEventListener('click', () => this.reset());
        document.getElementById('retryBtn')?.addEventListener('click', () => this.reset());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.updateFileLabel(file.name);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // Check if it's an Excel file
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                this.fileInput.files = files;
                this.updateFileLabel(file.name);
            } else {
                this.showError('Please upload an Excel file (.xlsx or .xls)');
            }
        }
    }

    updateFileLabel(filename) {
        document.getElementById('fileLabel').textContent = filename;
    }

    async handleSubmit(event) {
        event.preventDefault();

        const file = this.fileInput.files[0];
        if (!file) {
            this.showError('Please select a file');
            return;
        }

        // Show loading state
        this.uploadBtn.disabled = true;
        this.uploadBtn.classList.add('loading');

        try {
            // Create FormData
            const formData = new FormData();
            formData.append('file', file);

            // Add title if provided
            const title = document.getElementById('quizTitle').value.trim();
            if (title) {
                formData.append('title', title);
            }

            // Upload to API
            const response = await fetch('/api/upload-quiz', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Show success
            this.quizData = data.quiz;
            this.showSuccess(data);

        } catch (error) {
            console.error('Upload error:', error);
            this.showError(error.message || 'Failed to upload file. Please try again.');
        } finally {
            // Remove loading state
            this.uploadBtn.disabled = false;
            this.uploadBtn.classList.remove('loading');
        }
    }

    showSuccess(data) {
        const quizData = data.quiz;
        const saved = data.saved || false;

        // Hide form and error
        this.form.closest('.card').style.display = 'none';
        this.errorSection.style.display = 'none';

        // Show result section
        this.resultSection.style.display = 'block';

        // Update result info
        document.getElementById('resultTitle').textContent = quizData.metadata.title;

        // Count total questions
        const totalQuestions = quizData.rounds.reduce((total, round) => {
            return total + round.players.reduce((roundTotal, player) => {
                return roundTotal + player.questions.length;
            }, 0);
        }, 0);

        document.getElementById('resultCount').textContent = totalQuestions;

        // Update success message based on whether it was saved
        const successMessage = document.querySelector('.success-message');
        if (saved) {
            successMessage.innerHTML = `
                <strong>✓ Automatically saved!</strong><br>
                Your quiz has been saved to the repository and the quiz index has been updated.
                The quiz is now available in the app.
            `;
            successMessage.style.color = 'var(--success)';

            // Hide download/copy buttons if saved
            document.getElementById('downloadBtn').style.display = 'none';
            document.getElementById('copyBtn').style.display = 'none';
        } else {
            successMessage.innerHTML = `
                Your Excel file has been converted to quiz format.<br>
                <small style="color: var(--text-secondary);">Download the JSON file and add it to your repository manually.</small>
            `;
            successMessage.style.color = 'var(--text-primary)';

            // Show download/copy buttons
            document.getElementById('downloadBtn').style.display = 'inline-flex';
            document.getElementById('copyBtn').style.display = 'inline-flex';
        }

        // Show JSON preview
        document.getElementById('jsonOutput').textContent = JSON.stringify(quizData, null, 2);

        // Scroll to result
        this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showError(message) {
        // Hide form and result
        this.form.closest('.card').style.display = 'none';
        this.resultSection.style.display = 'none';

        // Show error section
        this.errorSection.style.display = 'block';
        document.getElementById('errorMessage').textContent = message;

        // Scroll to error
        this.errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    downloadJSON() {
        if (!this.quizData) return;

        // Create filename
        const filename = `${this.quizData.metadata.title.replace(/[^a-z0-9]/gi, '-')}.json`;

        // Create blob and download
        const blob = new Blob([JSON.stringify(this.quizData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async copyToClipboard() {
        if (!this.quizData) return;

        try {
            const jsonString = JSON.stringify(this.quizData, null, 2);
            await navigator.clipboard.writeText(jsonString);

            // Show feedback
            const btn = document.getElementById('copyBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.background = 'var(--success)';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);

        } catch (error) {
            console.error('Failed to copy:', error);
            alert('Failed to copy to clipboard');
        }
    }

    reset() {
        // Reset form
        this.form.reset();
        this.updateFileLabel('Choose Excel file or drag & drop');
        this.quizData = null;

        // Show form, hide results/errors
        this.form.closest('.card').style.display = 'block';
        this.resultSection.style.display = 'none';
        this.errorSection.style.display = 'none';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizUploader();
});
