import { lazy, Suspense, useEffect } from 'react';
import { totalStat } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import { initSvgColorAdjustments } from '@/utils/colorUtils';

const GithubSvg = lazy(() => loadSvgComponent(totalStat, './github.svg'));

const SVGStat = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      initSvgColorAdjustments();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="svgStat" className="mobile-heatmap">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <GithubSvg className="github-svg h-auto w-full" />
      </Suspense>
    </div>
  );
};

export default SVGStat;
