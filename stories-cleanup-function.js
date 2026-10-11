/* Optional Cloud Function (Firebase Blaze plan).  functions/index.js
   Runs whenever a story document is deleted (Firestore TTL, owner, or admin):
     - deletes the leftover `reactions` sub-collection
     - deletes the media from Cloudinary (needs your API secret – keep it in Secret Manager)

   Setup:
     cd functions && npm i firebase-functions firebase-admin cloudinary
     firebase functions:secrets:set CLOUDINARY_API_SECRET
     firebase deploy --only functions
*/
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

admin.initializeApp();
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

exports.cleanupStory = onDocumentDeleted({ document: 'stories/{id}', secrets: [CLOUDINARY_API_SECRET] }, async (event) => {
    const db = admin.firestore();
    const data = event.data ? event.data.data() : null;

    // 1) reactions sub-collection
    await db.recursiveDelete(db.collection('stories').doc(event.params.id));

    // 2) Cloudinary media
    if (!data) return;
    cloudinary.config({ cloud_name: 'ooq99nlw', api_key: process.env.CLOUDINARY_API_KEY || 'YOUR_API_KEY', api_secret: CLOUDINARY_API_SECRET.value() });
    const ids = Array.isArray(data.mediaPublicIds) && data.mediaPublicIds.length ? data.mediaPublicIds : (data.mediaPublicId ? [data.mediaPublicId] : []);
    const type = data.mediaType === 'video' ? 'video' : 'image';
    await Promise.allSettled(ids.map(id => cloudinary.uploader.destroy(id, { resource_type: type, invalidate: true })));
});
