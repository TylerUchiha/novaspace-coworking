import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID =
  'ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77';
const TEST_TO = process.env.TEST_EMAIL_TO || 'novaspace.org@gmail.com';

if (!getApps().length) {
  initializeApp({ projectId: 'refined-legend-420223' });
}

const db = getFirestore(DATABASE_ID);

const docRef = await db.collection('mail').add({
  to: TEST_TO,
  message: {
    subject: 'NovaSpace test email',
    html: '<p>If you got this, the Trigger Email from Firestore extension works.</p>',
    text: 'If you got this, the Trigger Email from Firestore extension works.',
  },
});

console.log('Created mail doc:', docRef.id);
console.log('Waiting for delivery status...');

for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const snap = await docRef.get();
  const data = snap.data();
  if (data?.delivery) {
    console.log('Delivery result:', JSON.stringify(data.delivery, null, 2));
    process.exit(data.delivery.state === 'SUCCESS' ? 0 : 1);
  }
  if (data?.delivery?.error) {
    console.log('Delivery error:', JSON.stringify(data.delivery, null, 2));
    process.exit(1);
  }
}

console.log('Timed out waiting for delivery field. Check Firebase logs.');
process.exit(1);
