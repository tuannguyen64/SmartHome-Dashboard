import { useSearchParams } from 'react-router-dom';
import { Segmented } from '../components/ui.jsx';
import DeveloperCatalog from './DeveloperCatalog.jsx';
import DeveloperDevices from './DeveloperDevices.jsx';

const TABS = [
  { value: 'kho', label: 'Kho thiết bị' },
  { value: 'danh-muc', label: 'Danh mục phần cứng' },
];

// Admin: một trang Thiết bị gồm kho thiết bị và danh mục (mẫu thiết bị, linh kiện, loại thiết bị)
export default function AdminDevicesHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'danh-muc' ? 'danh-muc' : 'kho';
  return (
    <div className="page developer-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Thiết bị</h1>
          <p className="page-sub">{tab === 'kho' ? 'Cấp thiết bị mới theo mẫu và quản lý từng thiết bị trong kho.' : 'Quản lý mẫu thiết bị, linh kiện và loại thiết bị dùng để cấp thiết bị.'}</p>
        </div>
        <Segmented value={tab} onChange={(value) => setParams(value === 'kho' ? {} : { tab: value }, { replace: true })} options={TABS} />
      </div>
      {tab === 'kho' ? <DeveloperDevices embedded /> : <DeveloperCatalog embedded />}
    </div>
  );
}
