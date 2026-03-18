const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'Merchant/OrdersPage.tsx');
let content = fs.readFileSync(filePath, 'utf8').split('\n');
// On supprime les lignes 112 à 138 (index 111 à 137)
console.log('Analyse du fichier...');
console.log('Ligne 113:', content[112]);
console.log('Ligne 137:', content[136]);
console.log('Ligne 139:', content[138]);

if (content[112].includes('fetchOrderGroups') && content[138].includes('fetchOrderGroups')) {
    console.log('Suppression de la version corrompue...');
    content.splice(111, 138 - 111); 
    fs.writeFileSync(filePath, content.join('\n'), 'utf8');
    console.log('Fichier réparé avec succès.');
} else {
    console.log('Vérification échouée. Les lignes ne correspondent pas.');
}
