const fs = require('fs');

const overrides = {
  "errorBoundary.reload": "Recarregar a página",
  "taggingServer.confirmAdd": "Confirmar adição",
  "errorBoundary.title": "Ups! Algo deu errado.",
  "serverDetailView.publish": "Publicar",
  "taggingServer.type": "Tipo:",
  "success.defaultServerName": "O seu servidor",
  "serverInspector.serverId": "ID do Servidor",
  "taggingServer.domainPlaceholder": "ex: metrics.oseu-site.com",
  "serverDetailView.workspaceGtm": "o seu espaço de trabalho GTM.",
  "serverDetailView.saveAnd": "Guarde e",
  "serverInspector.btnSuspended": "▶ Suspenso",
  "serverInspector.btnClose": "Fechar o Inspetor",
  "success.errConfigReq": "A Container Config é necessária.",
  "avatars.categories.categoryAnime": "Animé",
  "router.errorMessagePrefix": "Mensagem:",
  "school.errors.already_exists": "Já existe uma conta com este endereço de email.",
  "success.placeholderName": "Ex: O Meu Site Web",
  "avatars.names.bananaAstronaut": "Banana Astronauta",
  "router.errorTitle": "Ocorreu um erro",
  "success.planPartner": "Parceiro",
  "avatars.names.bananaNinja": "Banana Ninja",
  "avatars.names.bananaBusiness": "Banana Business",
  "success.errDomainFormat": "Formato de domínio inválido. Exemplo correto: analytics.omeu-site.com",
  "success.errConfigGeneric": "Erro durante a configuração.",
  "avatars.names.ace": "Ace",
  "school.errors.invalid_argument": "Dados inválidos. Por favor, verifique os seus dados.",
  "school.errors.resource_exhausted": "Muitas solicitações. Por favor, tente novamente mais tarde.",
  "success.placeholderConfig": "String em base64...",
  "school.errors.unexpected": "Ocorreu um erro inesperado.",
  "common.deleteConfirmKeyword": "ELIMINAR",
  "avatars.categories.categoryBanana": "Banana Pro",
  "router.errorReloadBtn": "Recarregar a página",
  "success.errConfigFormat": "Container Config inválida. Cole a string base64 do GTM.",
  "validation.invalid_email": "Endereço de email inválido",
  "validation.name_min_2": "O nome deve conter pelo menos 2 caracteres",
  "validation.invalid_phone": "Número de telefone inválido",
  "success.planAgency": "Agência",
  "avatars.names.goat": "Cabra Lenda",
  "success.errDomainReq": "O domínio é obrigatório.",
  "router.errorDesc": "A aplicação encontrou um problema inesperado. Por favor, recarregue a página.",
  "avatars.names.bananaCyber": "Banana Cyber"
};

const translatedPtPath = 'C:\\Users\\anton\\.gemini\\antigravity\\brain\\12a30f67-4585-454c-b318-37973488c835\\scratch\\translated_pt.json';
const ptJsonPath = 'C:\\Users\\anton\\Downloads\\windsurf-main (2)\\windsurf-main\\fessekapete\\stratads\\stratads-dashboard\\public\\locales\\pt.json';

const translatedPt = JSON.parse(fs.readFileSync(translatedPtPath, 'utf8'));
const ptJson = JSON.parse(fs.readFileSync(ptJsonPath, 'utf8'));

const setDeep = (obj, path, value) => {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
};

Object.keys(overrides).forEach(k => {
    translatedPt[k] = overrides[k];
    setDeep(ptJson, k, overrides[k]);
});

fs.writeFileSync(translatedPtPath, JSON.stringify(translatedPt, null, 2));
fs.writeFileSync(ptJsonPath, JSON.stringify(ptJson, null, 2));

console.log("Patched successfully!");
