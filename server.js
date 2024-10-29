const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Extract the original file extension
        const extension = path.extname(file.originalname);
        // Rename the file to "merged_file" with the original extension
        cb(null, `input${extension}`);
    }
});



const upload = multer({ storage: storage });

// Middleware to check if request is from Zapier
function isZapierRequest(req) {
    return req.headers['zapier-event-callback'] === 'true';
}

// Function to delete all files in the uploads directory
function cleanUploadsDirectory() {
    const uploadPath = path.join(__dirname, 'uploads');
    fs.readdir(uploadPath, (err, files) => {
        if (err) return console.error("Error reading directory:", err);
        files.forEach((file) => {
            try {
                fs.unlinkSync(path.join(uploadPath, file));
            } catch (err) {
                console.error("Error deleting file:", err);
            }
        });
    });
}

// Endpoint to merge video and audio with text overlay
app.post('/merge', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
    if (!req.files['video'] || !req.files['audio']) {
        return res.status(400).send('Video and audio files are required.');
    }

    const videoPath = path.join(__dirname, 'uploads', 'input.mp4');
    const audioPath = path.join(__dirname, 'uploads', 'input.mp3');
    const text = req.body.text ? req.body.text.replace(/'/g, "\\'") : 'Default Text';
    const outputPath = path.join(__dirname, 'uploads', 'merged_video.mp4');

    // Delete any existing output file
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }

    console.log("videoPath :- " + videoPath + " audiopath :- " + audioPath)

    // FFmpeg command to merge video and audio and overlay text
    ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-c:a', 'aac')
        .outputOptions('-vf', `drawtext=text='${text}':x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=white:fontsize=24`)
        .on('end', () => {
            console.log('Processing finished successfully.');

            if (isZapierRequest(req)) {
                res.json({ message: 'Video processing complete', downloadUrl: `http://localhost:${PORT}/downloads/merged_video.mp4` });
            } else {
                res.download(outputPath, (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    }
                });
            }
            cleanUploadsDirectory();
        })
        .on('error', (err) => {
            console.error('Error during processing:', err);
            res.status(500).send('Error processing files.');
            cleanUploadsDirectory();
        })
        .save(outputPath);
});

// Serve the HTML page for non-Zapier requests
app.get('/', (req, res) => {
    if (isZapierRequest(req)) {
        res.status(400).send('Direct access is not allowed from Zapier requests.');
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Serve processed videos
app.use('/downloads', express.static(path.join(__dirname, 'uploads')));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
