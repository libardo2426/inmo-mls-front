export const es = {
  app: {
    name: 'Innmo MLS',
  },
  notFound: {
    title: 'Página no encontrada',
    help: 'La dirección no existe o fue movida.',
  },
  theme: {
    toggle: 'Cambiar tema',
  },
  nav: {
    home: 'Inicio',
    agencies: 'Agencias',
  },
  shell: {
    toggleMenu: 'Plegar o desplegar el menú',
    mainNav: 'Navegación principal',
    userMenu: 'Menú de usuario',
    country: 'País',
    logout: 'Cerrar sesión',
  },
  states: {
    forbiddenTitle: 'No tiene permiso para ver esta página',
    forbiddenHelp: 'Si cree que debería tenerlo, pida acceso a un administrador.',
    genericError: 'Ocurrió un error inesperado. Inténtelo de nuevo.',
    reference: 'Referencia',
    retry: 'Reintentar',
    loadMore: 'Cargar más',
    loading: 'Cargando…',
  },
  config: {
    errorTitle: 'Error de configuración',
    errorHelp: 'La aplicación no puede iniciar. Revise las variables de entorno del despliegue.',
  },
  auth: {
    login: {
      title: 'Iniciar sesión',
      email: 'Correo electrónico',
      password: 'Contraseña',
      submit: 'Entrar',
      pending: 'Entrando…',
      validation: 'Ingrese su correo y su contraseña.',
      forgot: '¿Olvidó su contraseña?',
    },
    noAccess: {
      title: 'Sin acceso a este país',
      help: 'Su cuenta no tiene una membresía en este país. Pida a un administrador que le dé acceso.',
      logout: 'Cerrar sesión',
    },
    home: {
      signedInAs: 'Sesión iniciada como',
      country: 'País',
      logout: 'Cerrar sesión',
      loggingOut: 'Cerrando sesión…',
    },
    recover: {
      title: 'Recuperar contraseña',
      intro: 'Escriba su correo y le enviaremos un enlace para elegir una contraseña nueva.',
      email: 'Correo electrónico',
      submit: 'Enviar enlace',
      pending: 'Enviando…',
      validation: 'Ingrese un correo electrónico válido.',
      sent: 'Si el correo está registrado, le enviamos un enlace para restablecer su contraseña. Revise también la carpeta de spam.',
      backToLogin: 'Volver a iniciar sesión',
    },
    reset: {
      title: 'Elija una contraseña nueva',
      password: 'Contraseña nueva',
      confirm: 'Confirme la contraseña',
      submit: 'Cambiar contraseña',
      pending: 'Guardando…',
      tooShort: 'La contraseña debe tener al menos 12 caracteres.',
      mismatch: 'Las contraseñas no coinciden.',
      done: 'Su contraseña se cambió. Ya puede iniciar sesión.',
      requestNew: 'Solicitar un enlace nuevo',
    },
    verify: {
      title: 'Verificación en dos pasos',
      code: 'Código de 6 dígitos',
      backupCode: 'Código de respaldo',
      submit: 'Verificar',
      pending: 'Verificando…',
      useBackup: 'Usar un código de respaldo',
      useTotp: 'Usar el código de la aplicación',
      backToLogin: 'Volver a iniciar sesión',
    },
    activate: {
      title: 'Active la verificación en dos pasos',
      intro: 'Su cuenta necesita un segundo paso para entrar. Confirme su contraseña para empezar.',
      password: 'Contraseña actual',
      start: 'Continuar',
      starting: 'Generando…',
      scanTitle: 'Escanee el código',
      scanHelp:
        'Escanee el código con su aplicación de autenticación (Google Authenticator, Authy, 1Password…) o escriba la clave a mano.',
      qrLabel: 'Código QR para la aplicación de autenticación',
      secretLabel: 'Clave para escribir a mano',
      copySecret: 'Copiar clave',
      code: 'Código de 6 dígitos',
      verify: 'Activar',
      verifying: 'Activando…',
      codesTitle: 'Guarde sus códigos de respaldo',
      codesHelp:
        'Cada código sirve una sola vez si pierde acceso a su aplicación. Guárdelos en un lugar seguro: no se volverán a mostrar.',
      copyCodes: 'Copiar códigos',
      downloadCodes: 'Descargar códigos',
      copied: 'Copiado',
      saved: 'Ya guardé mis códigos',
      continue: 'Continuar',
      alreadyEnabled: 'La verificación en dos pasos ya está activa en su cuenta.',
      goToLogin: 'Ir a iniciar sesión',
      downloadName: 'codigos-de-respaldo.txt',
    },
    status: {
      maintenanceTitle: 'Servicio en mantenimiento',
      maintenanceHelp:
        'El país no está disponible por el momento. Inténtelo de nuevo en unos minutos.',
      offlineTitle: 'Sin conexión con el servidor',
      offlineHelp: 'No se pudo contactar al servidor. Revise su conexión e inténtelo de nuevo.',
      retry: 'Reintentar',
    },
    errors: {
      credentials: 'El correo o la contraseña no son correctos.',
      codeInvalid: 'El código no es válido. Inténtelo de nuevo.',
      passwordInvalid: 'La contraseña no es correcta.',
      tokenInvalid: 'El enlace no es válido o ya venció. Solicite uno nuevo.',
      locked: 'Demasiados intentos fallidos. Espere unos minutos antes de volver a intentarlo.',
      twoFactorExpired: 'La verificación venció. Vuelva a iniciar sesión.',
      origin: 'No se pudo validar el origen de la solicitud. Contacte a soporte.',
      network: 'No se pudo conectar con el servidor. Revise su conexión e inténtelo de nuevo.',
      generic: 'Ocurrió un error inesperado. Inténtelo de nuevo.',
      reference: 'referencia',
      rateLimited: (seconds?: number): string =>
        seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
          ? `Demasiados intentos. Espere ${seconds} s antes de volver a intentarlo.`
          : 'Demasiados intentos. Espere un momento antes de volver a intentarlo.',
    },
  },
  agencies: {
    errors: {
      notReviewable: 'Otra persona ya revisó esta solicitud. Se actualizó el estado.',
      reasonRequired: 'Escriba el motivo para continuar.',
      notFound: 'No se encontró la solicitud.',
      network: 'No se pudo conectar con el servidor. Revise su conexión.',
      generic: 'No se pudo completar la acción. Inténtelo de nuevo.',
      reference: 'Referencia',
      rateLimited: (seconds?: number): string =>
        seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
          ? `Demasiados intentos. Espere ${seconds} s antes de volver a intentarlo.`
          : 'Demasiados intentos. Espere un momento antes de volver a intentarlo.',
    },
  },
} as const;
