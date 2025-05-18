/**
 * 解决方案：通过预约ID在验证邮件链接中传递预约信息
 * 工作流程：
 * 1. 在预约流程中，将预约信息通过API保存到Firestore并获取唯一ID
 * 2. 将这个ID附加到验证邮件链接中
 * 3. 当用户点击链接时，系统根据ID从Firestore获取预约信息
 * 4. 完成预约后删除临时数据
 */

// 根据ID保存临时预约数据
export const saveTempReservation = async (reservationData: any): Promise<string | null> => {
  try {
    // 通过API保存临时预约数据
    const response = await fetch('/api/temp-reservation/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationData })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.id || null; // 返回API生成的唯一ID
  } catch (error) {
    console.error("Failed to save temporary reservation:", error);
    return null;
  }
};

// 根据ID获取临时预约数据
export const getTempReservationById = async (id: string): Promise<string | null> => {
  if (!id) return null;
  
  try {
    // 通过API获取临时预约数据
    const response = await fetch(`/api/temp-reservation/${id}`);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data.reservationData || null;
  } catch (error) {
    console.error("Failed to fetch reservation data:", error);
    return null;
  }
};

// 根据ID删除临时预约数据
export const deleteTempReservationById = async (id: string): Promise<boolean> => {
  if (!id) return false;
  
  try {
    // 通过API删除临时预约数据
    const response = await fetch(`/api/temp-reservation/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error("Failed to delete temporary reservation by ID:", error);
    return false;
  }
}; 