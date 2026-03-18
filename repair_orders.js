const fs = require('fs');
const path = require('path');
const filePath = 'components/Merchant/OrdersPage.tsx';
let content = fs.readFileSync(filePath, 'utf8').split('\n');
// On supprime les lignes 113 à 139 (index 112 à 138)
// On verifie d'abord que le contenu correspond à peu près
if (content[112].includes('fetchOrderGroups') && content[140].includes('fetchOrderGroups')) {
    console.log('Suppression de la version corrompue...');
    content.splice(112, 140 - 112); 
    fs.writeFileSync(filePath, content.join('\n'), 'utf8');
    console.log('Fichier réparé.');
} else {
    console.log('Vérification échouée. Lignes actuelles :');
    console.log('112:', content[112]);
    console.log('140:', content[140]);
}
