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
} as const;
