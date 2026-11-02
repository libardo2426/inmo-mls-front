import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { DescriptionItem, DescriptionList } from './DescriptionList';
import { PageHeader } from './PageHeader';
import { Section } from './Section';

describe('PageHeader', () => {
  it('expone un único h1 con el título, la descripción y las acciones', () => {
    render(
      <PageHeader title="Agencias" description="Solicitudes" actions={<button>Filtrar</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Agencias' })).toBeInTheDocument();
    expect(screen.getByText('Solicitudes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument();
  });

  it('con un título larguísimo conserva las acciones y permite el corte de palabras', () => {
    const title = 'Inmobiliaria '.repeat(12) + 'X'.repeat(60);
    render(<PageHeader title={title} actions={<button>Aprobar</button>} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveClass('min-w-0');
    expect(heading).toHaveClass('wrap-break-word');
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('muestra el enlace de regreso cuando se pasa', () => {
    render(<PageHeader title="Detalle" backLink={<a href="/x">Volver</a>} />);
    expect(screen.getByRole('link', { name: 'Volver' })).toBeInTheDocument();
  });
});

describe('Section', () => {
  it('es una región nombrada por su título (h2)', () => {
    render(
      <Section title="Solicitud">
        <p>contenido</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Solicitud' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Solicitud' })).toHaveTextContent('contenido');
  });
});

describe('DescriptionList', () => {
  it('asocia término y definición', () => {
    render(
      <DescriptionList>
        <DescriptionItem label="Correo">a@b.co</DescriptionItem>
      </DescriptionList>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Correo');
    expect(screen.getByRole('definition')).toHaveTextContent('a@b.co');
  });

  it.each([null, undefined, ''])('con valor %j muestra el marcador de sin dato', (value) => {
    render(
      <DescriptionList>
        <DescriptionItem label="Teléfono">{value}</DescriptionItem>
      </DescriptionList>,
    );
    expect(screen.getByRole('definition')).toHaveTextContent(es.agencies.detail.none);
  });
});
