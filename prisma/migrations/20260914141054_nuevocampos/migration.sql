-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'GESTION_ESCOLAR', 'EOE_DIRECTIVO', 'DOCENTE', 'ESTUDIANTE', 'FAMILIA');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoEstudiante" AS ENUM ('ACTIVO', 'INACTIVO', 'EGRESADO', 'PASE_SALIDA', 'CONDICIONAL');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANANA', 'TARDE', 'VESPERTINO', 'CONTRATURNO');

-- CreateEnum
CREATE TYPE "Orientacion" AS ENUM ('ORIENTADA', 'TECNICA', 'AGRARIA', 'ARTE');

-- CreateEnum
CREATE TYPE "TipoCursada" AS ENUM ('CURSA', 'RECURSA');

-- CreateEnum
CREATE TYPE "EstadoMateria" AS ENUM ('EN_CURSO', 'APROBADA_ACREDITADA', 'PENDIENTE_1C', 'PENDIENTE_2C', 'EN_INTENSIFICACION', 'CONTINUA_INTENSIFICANDO', 'MPAA');

-- CreateEnum
CREATE TYPE "ValoracionPreliminar" AS ENUM ('TEA', 'TEP', 'TED');

-- CreateEnum
CREATE TYPE "Cuatrimestre" AS ENUM ('PRIMERO', 'SEGUNDO');

-- CreateEnum
CREATE TYPE "PeriodoIntensificacion" AS ENUM ('DICIEMBRE', 'FEBRERO_MARZO', 'AGOSTO');

-- CreateEnum
CREATE TYPE "ModeloIntensificacion" AS ENUM ('MODELO_1', 'MODELO_2', 'MODELO_3', 'MODELO_4');

-- CreateEnum
CREATE TYPE "CodigoResultadoIntensificacion" AS ENUM ('AA', 'CCA', 'CSA');

-- CreateEnum
CREATE TYPE "EstadoRite" AS ENUM ('BORRADOR', 'CERRADO', 'FIRMADO');

-- CreateEnum
CREATE TYPE "TipoEventoIntervencion" AS ENUM ('PEDAGOGICO', 'SALUD', 'CONDUCTA');

-- CreateEnum
CREATE TYPE "EstadoPate" AS ENUM ('ACTIVO', 'EN_SEGUIMIENTO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "TipoPase" AS ENUM ('SALIDA', 'ENTRADA');

-- CreateEnum
CREATE TYPE "DictamenEquivalencia" AS ENUM ('TOTAL', 'PARCIAL', 'NO_RECONOCIDA');

-- CreateEnum
CREATE TYPE "ModeloOrganizativo" AS ENUM ('OPCION_A', 'OPCION_B', 'OPCION_C', 'OPCION_D');

-- CreateEnum
CREATE TYPE "TipoAccionAuditoria" AS ENUM ('ALTA', 'MODIFICACION', 'BAJA', 'VISUALIZACION_SENSIBLE', 'FIRMA', 'CIERRE', 'REAPERTURA');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('INASISTENCIAS', 'MATERIAS_PENDIENTES', 'VALORACION_TED', 'RIESGO_ABANDONO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "mfaHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloLectivo" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "fechaInicioCuatrimestre1" TIMESTAMP(3),
    "fechaFinCuatrimestre1" TIMESTAMP(3),
    "fechaInicioCuatrimestre2" TIMESTAMP(3),
    "fechaFinCuatrimestre2" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CicloLectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarioHito" (
    "id" TEXT NOT NULL,
    "cicloLectivoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),

    CONSTRAINT "CalendarioHito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoSeccion" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "turno" "Turno" NOT NULL,
    "orientacion" "Orientacion",
    "cicloLectivoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursoSeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEstudio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orientacion" "Orientacion" NOT NULL,
    "anioVigencia" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEstudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEstudioMateria" (
    "id" TEXT NOT NULL,
    "planEstudioId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "cursoSeccionId" TEXT,
    "anioCorrespondiente" INTEGER NOT NULL,

    CONSTRAINT "PlanEstudioMateria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "anioCorrespondiente" INTEGER NOT NULL,
    "area" TEXT NOT NULL,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteMateriaCurso" (
    "id" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "cursoSeccionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocenteMateriaCurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudiante" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "lugarNacimiento" TEXT,
    "domicilio" TEXT NOT NULL,
    "localidad" TEXT,
    "telefono" TEXT,
    "legajo" TEXT NOT NULL,
    "estado" "EstadoEstudiante" NOT NULL DEFAULT 'ACTIVO',
    "tienePPI" BOOLEAN NOT NULL DEFAULT false,
    "fechaCondicionalHasta" TIMESTAMP(3),
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdultoResponsable" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "parentesco" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdultoResponsable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstudianteAdulto" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "adultoResponsableId" TEXT NOT NULL,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EstudianteAdulto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialMatricula" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cursoSeccionId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "motivoBaja" TEXT,

    CONSTRAINT "HistorialMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cursoSeccionId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "tipoCursada" "TipoCursada" NOT NULL DEFAULT 'CURSA',
    "cicloLectivoId" TEXT NOT NULL,
    "estadoMateria" "EstadoMateria" NOT NULL DEFAULT 'EN_CURSO',
    "anioMateriaOriginal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaDiaria" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valorFalta" DOUBLE PRECISION NOT NULL,
    "turno" "Turno" NOT NULL,
    "justificada" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsistenciaDiaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaMateria" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "inscripcionId" TEXT,
    "fechaClase" DATE NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "justificada" BOOLEAN NOT NULL DEFAULT false,
    "esIntensificacion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AsistenciaMateria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "valoracionPreliminar1" "ValoracionPreliminar",
    "fundamentacion1" TEXT,
    "notaCuatrimestre1" INTEGER,
    "valoracionPreliminar2" "ValoracionPreliminar",
    "fundamentacion2" TEXT,
    "notaCuatrimestre2" INTEGER,
    "recuperoSaberes1erEn2do" BOOLEAN,
    "notaFinal" INTEGER,
    "estadoMateria" "EstadoMateria" NOT NULL DEFAULT 'EN_CURSO',
    "cerrado1C" BOOLEAN NOT NULL DEFAULT false,
    "cerrado2C" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intensificacion" (
    "id" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "periodo" "PeriodoIntensificacion" NOT NULL,
    "modelo" "ModeloIntensificacion" NOT NULL,
    "cursoSeccionDestino" TEXT,
    "codigoResultado" "CodigoResultadoIntensificacion",
    "notaIntensificacion" INTEGER,
    "saberesPendientes" TEXT NOT NULL,
    "saberesAlCierre" TEXT,
    "docenteResponsableId" TEXT,
    "urlEvidencia" TEXT,
    "fechaEvaluacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intensificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rite" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cicloLectivoId" TEXT NOT NULL,
    "cuatrimestre" "Cuatrimestre" NOT NULL,
    "esPostIntensificacion" BOOLEAN NOT NULL DEFAULT false,
    "observacionesGenerales" TEXT,
    "estado" "EstadoRite" NOT NULL DEFAULT 'BORRADOR',
    "urlPdf" TEXT,
    "fechaFirma" TIMESTAMP(3),
    "autoridadFirmanteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdteReunion" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "periodo" "PeriodoIntensificacion" NOT NULL,
    "cicloLectivoId" TEXT NOT NULL,
    "consideraciones" TEXT,
    "actaUrl" TEXT,
    "actaFirmada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdteReunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdteIntegrante" (
    "id" TEXT NOT NULL,
    "edteReunionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolEnReunion" TEXT,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "firmaHash" TEXT,

    CONSTRAINT "EdteIntegrante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pate" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "edteReunionId" TEXT NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "estrategiasAcompanamiento" TEXT NOT NULL,
    "cronograma" TEXT,
    "estado" "EstadoPate" NOT NULL DEFAULT 'ACTIVO',
    "notificacionUrl" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateMateriaIntensificar" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "modelo" "ModeloIntensificacion" NOT NULL,
    "ubicacion" TEXT,

    CONSTRAINT "PateMateriaIntensificar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateMateriaRecursar" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "ubicacion" TEXT,

    CONSTRAINT "PateMateriaRecursar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateSeguimiento" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avances" TEXT NOT NULL,
    "evaluacion" TEXT,

    CONSTRAINT "PateSeguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervencion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipoEvento" "TipoEventoIntervencion" NOT NULL,
    "actoresInvolucrados" TEXT,
    "descripcion" TEXT NOT NULL,
    "propuestaIntervencion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenciaUrl" TEXT,
    "firmaDigital" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanForte" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "objetivosPedagogicos" TEXT NOT NULL,
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanForte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanForteReporte" (
    "id" TEXT NOT NULL,
    "planForteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evolucion" TEXT NOT NULL,

    CONSTRAINT "PlanForteReporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictoLegal" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "codigoConflicto" TEXT NOT NULL,
    "informeDetallado" TEXT NOT NULL,
    "bloqueoEdicion" BOOLEAN NOT NULL DEFAULT true,
    "hashFirmaDigital" TEXT NOT NULL,
    "uuidDocumento" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaSuceso" TIMESTAMP(3),

    CONSTRAINT "ConflictoLegal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictoLegalAnexo" (
    "id" TEXT NOT NULL,
    "conflictoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashFirmaDigital" TEXT NOT NULL,

    CONSTRAINT "ConflictoLegalAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accion" "TipoAccionAuditoria" NOT NULL,
    "entidadAfectada" TEXT NOT NULL,
    "entidadId" TEXT,
    "datoAnterior" JSONB,
    "datoNuevo" JSONB,
    "direccionIp" TEXT NOT NULL,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "remitenteId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leidoPorFamilia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmacionRecepcion" (
    "id" TEXT NOT NULL,
    "adultoResponsableId" TEXT NOT NULL,
    "riteId" TEXT,
    "tipoComunicacion" TEXT NOT NULL,
    "fechaConfirmacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmacionRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoLegajo" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "urlArchivo" TEXT NOT NULL,
    "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoLegajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaseInterinstitucional" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoPase" NOT NULL,
    "causa" TEXT NOT NULL,
    "documentacionUrl" TEXT,
    "firmaFamiliaUrl" TEXT,
    "institucionOrigenDestino" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaseInterinstitucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equivalencia" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "materiaOrigen" TEXT NOT NULL,
    "institucionOrigen" TEXT NOT NULL,
    "jurisdiccionOrigen" TEXT,
    "programaOrigenUrl" TEXT,
    "certificacionUrl" TEXT,
    "dictamen" "DictamenEquivalencia",
    "resolucionInternaUrl" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equivalencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "numeroRegistro" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "urlAnaliticoFinal" TEXT,
    "urlTitulo" TEXT,
    "firmaDigitalHash" TEXT,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComisionEvaluadora" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "integrantes" TEXT NOT NULL,
    "actaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComisionEvaluadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComisionEvaluadoraMateria" (
    "id" TEXT NOT NULL,
    "comisionEvaluadoraId" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "temasEvaluados" TEXT,
    "calificacion" INTEGER,

    CONSTRAINT "ComisionEvaluadoraMateria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcuerdoConvivencia" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seguimiento" TEXT,

    CONSTRAINT "AcuerdoConvivencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionInstitucional" (
    "id" TEXT NOT NULL,
    "modeloOrganizativo" "ModeloOrganizativo" NOT NULL,
    "fechaAdopcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimientoMinimo" TIMESTAMP(3) NOT NULL,
    "topeInasistenciasInstitucional" INTEGER NOT NULL DEFAULT 28,
    "porcentajeAsistenciaMateria" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionInstitucional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_estado_idx" ON "Usuario"("rol", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "CicloLectivo_anio_key" ON "CicloLectivo"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "CursoSeccion_anio_division_turno_cicloLectivoId_key" ON "CursoSeccion"("anio", "division", "turno", "cicloLectivoId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEstudioMateria_planEstudioId_materiaId_key" ON "PlanEstudioMateria"("planEstudioId", "materiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Materia_codigo_key" ON "Materia"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "DocenteMateriaCurso_docenteId_materiaId_cursoSeccionId_key" ON "DocenteMateriaCurso"("docenteId", "materiaId", "cursoSeccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Estudiante_dni_key" ON "Estudiante"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Estudiante_legajo_key" ON "Estudiante"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "Estudiante_usuarioId_key" ON "Estudiante"("usuarioId");

-- CreateIndex
CREATE INDEX "Estudiante_apellido_nombre_idx" ON "Estudiante"("apellido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "AdultoResponsable_usuarioId_key" ON "AdultoResponsable"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "EstudianteAdulto_estudianteId_adultoResponsableId_key" ON "EstudianteAdulto"("estudianteId", "adultoResponsableId");

-- CreateIndex
CREATE INDEX "HistorialMatricula_estudianteId_idx" ON "HistorialMatricula"("estudianteId");

-- CreateIndex
CREATE INDEX "Inscripcion_cicloLectivoId_estadoMateria_idx" ON "Inscripcion"("cicloLectivoId", "estadoMateria");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_estudianteId_materiaId_cicloLectivoId_tipoCursa_key" ON "Inscripcion"("estudianteId", "materiaId", "cicloLectivoId", "tipoCursada");

-- CreateIndex
CREATE INDEX "AsistenciaDiaria_estudianteId_fecha_idx" ON "AsistenciaDiaria"("estudianteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaDiaria_estudianteId_fecha_turno_key" ON "AsistenciaDiaria"("estudianteId", "fecha", "turno");

-- CreateIndex
CREATE INDEX "AsistenciaMateria_estudianteId_materiaId_fechaClase_idx" ON "AsistenciaMateria"("estudianteId", "materiaId", "fechaClase");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_inscripcionId_key" ON "Calificacion"("inscripcionId");

-- CreateIndex
CREATE INDEX "Calificacion_estadoMateria_idx" ON "Calificacion"("estadoMateria");

-- CreateIndex
CREATE INDEX "Intensificacion_inscripcionId_periodo_idx" ON "Intensificacion"("inscripcionId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "Rite_estudianteId_cicloLectivoId_cuatrimestre_esPostIntensi_key" ON "Rite"("estudianteId", "cicloLectivoId", "cuatrimestre", "esPostIntensificacion");

-- CreateIndex
CREATE UNIQUE INDEX "EdteIntegrante_edteReunionId_usuarioId_key" ON "EdteIntegrante"("edteReunionId", "usuarioId");

-- CreateIndex
CREATE INDEX "Pate_estudianteId_idx" ON "Pate"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "PateMateriaIntensificar_pateId_inscripcionId_key" ON "PateMateriaIntensificar"("pateId", "inscripcionId");

-- CreateIndex
CREATE UNIQUE INDEX "PateMateriaRecursar_pateId_inscripcionId_key" ON "PateMateriaRecursar"("pateId", "inscripcionId");

-- CreateIndex
CREATE INDEX "PateSeguimiento_pateId_idx" ON "PateSeguimiento"("pateId");

-- CreateIndex
CREATE INDEX "Intervencion_estudianteId_fecha_idx" ON "Intervencion"("estudianteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PlanForte_estudianteId_key" ON "PlanForte"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictoLegal_uuidDocumento_key" ON "ConflictoLegal"("uuidDocumento");

-- CreateIndex
CREATE INDEX "ConflictoLegal_estudianteId_idx" ON "ConflictoLegal"("estudianteId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_fechaHora_idx" ON "LogAuditoria"("usuarioId", "fechaHora");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidadAfectada_entidadId_idx" ON "LogAuditoria"("entidadAfectada", "entidadId");

-- CreateIndex
CREATE INDEX "Notificacion_estudianteId_leida_idx" ON "Notificacion"("estudianteId", "leida");

-- CreateIndex
CREATE INDEX "Mensaje_estudianteId_createdAt_idx" ON "Mensaje"("estudianteId", "createdAt");

-- CreateIndex
CREATE INDEX "ConfirmacionRecepcion_adultoResponsableId_idx" ON "ConfirmacionRecepcion"("adultoResponsableId");

-- CreateIndex
CREATE INDEX "DocumentoLegajo_estudianteId_tipo_idx" ON "DocumentoLegajo"("estudianteId", "tipo");

-- CreateIndex
CREATE INDEX "PaseInterinstitucional_estudianteId_idx" ON "PaseInterinstitucional"("estudianteId");

-- CreateIndex
CREATE INDEX "Equivalencia_estudianteId_idx" ON "Equivalencia"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_estudianteId_key" ON "Titulo"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_numeroRegistro_key" ON "Titulo"("numeroRegistro");

-- CreateIndex
CREATE INDEX "Titulo_estudianteId_idx" ON "Titulo"("estudianteId");

-- CreateIndex
CREATE INDEX "ComisionEvaluadora_estudianteId_idx" ON "ComisionEvaluadora"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "ComisionEvaluadoraMateria_comisionEvaluadoraId_inscripcionI_key" ON "ComisionEvaluadoraMateria"("comisionEvaluadoraId", "inscripcionId");

-- CreateIndex
CREATE INDEX "AcuerdoConvivencia_estudianteId_idx" ON "AcuerdoConvivencia"("estudianteId");

-- AddForeignKey
ALTER TABLE "CalendarioHito" ADD CONSTRAINT "CalendarioHito_cicloLectivoId_fkey" FOREIGN KEY ("cicloLectivoId") REFERENCES "CicloLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoSeccion" ADD CONSTRAINT "CursoSeccion_cicloLectivoId_fkey" FOREIGN KEY ("cicloLectivoId") REFERENCES "CicloLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudioMateria" ADD CONSTRAINT "PlanEstudioMateria_planEstudioId_fkey" FOREIGN KEY ("planEstudioId") REFERENCES "PlanEstudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudioMateria" ADD CONSTRAINT "PlanEstudioMateria_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudioMateria" ADD CONSTRAINT "PlanEstudioMateria_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteMateriaCurso" ADD CONSTRAINT "DocenteMateriaCurso_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteMateriaCurso" ADD CONSTRAINT "DocenteMateriaCurso_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteMateriaCurso" ADD CONSTRAINT "DocenteMateriaCurso_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdultoResponsable" ADD CONSTRAINT "AdultoResponsable_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstudianteAdulto" ADD CONSTRAINT "EstudianteAdulto_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstudianteAdulto" ADD CONSTRAINT "EstudianteAdulto_adultoResponsableId_fkey" FOREIGN KEY ("adultoResponsableId") REFERENCES "AdultoResponsable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMatricula" ADD CONSTRAINT "HistorialMatricula_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMatricula" ADD CONSTRAINT "HistorialMatricula_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cicloLectivoId_fkey" FOREIGN KEY ("cicloLectivoId") REFERENCES "CicloLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaDiaria" ADD CONSTRAINT "AsistenciaDiaria_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaMateria" ADD CONSTRAINT "AsistenciaMateria_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaMateria" ADD CONSTRAINT "AsistenciaMateria_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaMateria" ADD CONSTRAINT "AsistenciaMateria_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intensificacion" ADD CONSTRAINT "Intensificacion_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_cicloLectivoId_fkey" FOREIGN KEY ("cicloLectivoId") REFERENCES "CicloLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_autoridadFirmanteId_fkey" FOREIGN KEY ("autoridadFirmanteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteReunion" ADD CONSTRAINT "EdteReunion_cicloLectivoId_fkey" FOREIGN KEY ("cicloLectivoId") REFERENCES "CicloLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteIntegrante" ADD CONSTRAINT "EdteIntegrante_edteReunionId_fkey" FOREIGN KEY ("edteReunionId") REFERENCES "EdteReunion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteIntegrante" ADD CONSTRAINT "EdteIntegrante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_edteReunionId_fkey" FOREIGN KEY ("edteReunionId") REFERENCES "EdteReunion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateMateriaIntensificar" ADD CONSTRAINT "PateMateriaIntensificar_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateMateriaIntensificar" ADD CONSTRAINT "PateMateriaIntensificar_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateMateriaRecursar" ADD CONSTRAINT "PateMateriaRecursar_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateMateriaRecursar" ADD CONSTRAINT "PateMateriaRecursar_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSeguimiento" ADD CONSTRAINT "PateSeguimiento_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervencion" ADD CONSTRAINT "Intervencion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervencion" ADD CONSTRAINT "Intervencion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanForte" ADD CONSTRAINT "PlanForte_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanForteReporte" ADD CONSTRAINT "PlanForteReporte_planForteId_fkey" FOREIGN KEY ("planForteId") REFERENCES "PlanForte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictoLegal" ADD CONSTRAINT "ConflictoLegal_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictoLegal" ADD CONSTRAINT "ConflictoLegal_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictoLegalAnexo" ADD CONSTRAINT "ConflictoLegalAnexo_conflictoId_fkey" FOREIGN KEY ("conflictoId") REFERENCES "ConflictoLegal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_remitenteId_fkey" FOREIGN KEY ("remitenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacionRecepcion" ADD CONSTRAINT "ConfirmacionRecepcion_adultoResponsableId_fkey" FOREIGN KEY ("adultoResponsableId") REFERENCES "AdultoResponsable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacionRecepcion" ADD CONSTRAINT "ConfirmacionRecepcion_riteId_fkey" FOREIGN KEY ("riteId") REFERENCES "Rite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoLegajo" ADD CONSTRAINT "DocumentoLegajo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaseInterinstitucional" ADD CONSTRAINT "PaseInterinstitucional_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equivalencia" ADD CONSTRAINT "Equivalencia_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComisionEvaluadora" ADD CONSTRAINT "ComisionEvaluadora_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComisionEvaluadoraMateria" ADD CONSTRAINT "ComisionEvaluadoraMateria_comisionEvaluadoraId_fkey" FOREIGN KEY ("comisionEvaluadoraId") REFERENCES "ComisionEvaluadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComisionEvaluadoraMateria" ADD CONSTRAINT "ComisionEvaluadoraMateria_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "Inscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcuerdoConvivencia" ADD CONSTRAINT "AcuerdoConvivencia_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
