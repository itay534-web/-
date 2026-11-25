// מוסיף ל-AndroidManifest את ההרשאות הדרושות לתזכורות (התראות יומיות, גם אחרי הפעלה מחדש של המכשיר)
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(file)) { console.error('לא נמצא AndroidManifest.xml. הרץ קודם: npx cap add android'); process.exit(1); }
let xml = fs.readFileSync(file, 'utf8');
const perms = ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'SCHEDULE_EXACT_ALARM', 'WAKE_LOCK', 'VIBRATE'];
let add = '';
perms.forEach(p => {
  if (xml.indexOf('android.permission.' + p) === -1) add += '    <uses-permission android:name="android.permission.' + p + '" />\n';
});
if (add) {
  xml = xml.replace('</manifest>', add + '</manifest>');
  fs.writeFileSync(file, xml);
  console.log('נוספו הרשאות ל-AndroidManifest.xml');
} else console.log('ההרשאות כבר קיימות');
