import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';

export function GuidesView(): React.JSX.Element {
  return (
    <section className="guides-view">
      <h1>Гайды</h1>
      <p>Скоро здесь появятся инструкции для команды.</p>

      <div className="guide-cards">
        <article className="card reveal">
          <h3>Проверка фото</h3>
          <p>Как быстро ревьюить отчет исполнителя и отклонять неверные точки.</p>
          <button className="ghost-link" type="button">
            Открыть
            <ArrowOutwardRounded fontSize="small" />
          </button>
        </article>

        <article className="card reveal">
          <h3>Работа с адресами</h3>
          <p>Правила импорта CSV и структуры районов для чистой базы.</p>
          <button className="ghost-link" type="button">
            Открыть
            <ArrowOutwardRounded fontSize="small" />
          </button>
        </article>
      </div>
    </section>
  );
}
