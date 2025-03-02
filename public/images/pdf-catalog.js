// document.addEventListener('DOMContentLoaded', function() {
//     const pdfCatalogToggle = document.getElementById('pdfCatalogToggle');

//     if (pdfCatalogToggle) {
//         pdfCatalogToggle.addEventListener('click', function() {
//             const catalogPath = '/images/Catalogue-Discado-2025.pdf';

//             // Créer un élément <a> temporaire
//             const link = document.createElement('a');
//             link.href = catalogPath;
//             link.download = 'Catalogue-Discado-2025.pdf'; // Nom du fichier à télécharger

//             // Ajouter le lien au DOM, déclencher le clic, puis supprimer l'élément
//             document.body.appendChild(link);
//             link.click();
//             document.body.removeChild(link);
//         });
//     }
// });

document.addEventListener('DOMContentLoaded', function() {
    const pdfCatalogToggle = document.getElementById('pdfCatalogToggle');

    if (pdfCatalogToggle) {
        pdfCatalogToggle.addEventListener('click', function() {
            const catalogPath = 'http://192.168.1.100:3000/images/Catalogue-Discado-2025.pdf'; // Modifier avec l'IP correcte

            const link = document.createElement('a');
            link.href = catalogPath;
            link.download = 'Catalogue-Discado-2025.pdf'; // Forcer le téléchargement

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
