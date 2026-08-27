import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Shell } from '../ui';

export default function NotFound() {
  return <Shell>
    <div className="page-container page-top">
      <div className="state-panel">
        <Compass />
        <h1>Không có trang này</h1>
        <p>Đường dẫn có thể đã đổi hoặc bị gõ sai.</p>
        <Link className="button primary" to="/">Về trang chủ</Link>
      </div>
    </div>
  </Shell>;
}
